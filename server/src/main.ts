import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { DEFAULT_PRIVACY, Store, type Activity, type Person, type Privacy } from './store.ts'

/**
 * The Lumio server. It serves the Lumio web app itself and, under /api, what Jellyfin doesn't let users share with
 * each other: who follows whom, privacy choices, and what friends (people who follow each other) are playing, live.
 *
 * It keeps no accounts of its own: every API request carries the user's Jellyfin token, which it checks with the
 * Jellyfin server (and caches for a few minutes). Live updates go out as server-sent events.
 *
 * Settings (environment): JELLYFIN_URL (required), PORT (8097), DATA_DIR (./data), WEB_DIR (the built app, ../dist),
 * ALLOWED_ORIGINS (comma-separated; only needed when the app runs elsewhere, e.g. the Vite dev server),
 * TICKETMASTER_API_KEY and LASTFM_API_KEY (optional; otherwise the app's own keys are used).
 */
const JELLYFIN_URL = (process.env.JELLYFIN_URL ?? '').replace(/\/+$/, '')
const PORT = Number(process.env.PORT ?? 8097)
const DATA_DIR = process.env.DATA_DIR ?? './data'
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
const WEB_DIR = resolve(process.env.WEB_DIR ?? join(import.meta.dirname, '../../dist'))
/** A token is checked with Jellyfin again after this long. */
const TOKEN_TTL_MS = 5 * 60_000
/** Largest request body accepted (bytes). */
const BODY_LIMIT = 16 * 1024
/** Hosts whose pictures the image relay fetches (podcast covers from Apple); nothing else, so it is no open proxy. */
const IMAGE_HOSTS = /(^|\.)mzstatic\.com$/
/** Largest picture relayed (bytes). */
const IMAGE_LIMIT = 8 * 1024 * 1024
const IMAGE_DIR = join(DATA_DIR, 'images')
const RELAY_DIR = join(DATA_DIR, 'relay')
/** Largest podcast feed, chapter list or transcript relayed (bytes). */
const FEED_LIMIT = 15 * 1024 * 1024
/** What the feed relay passes on: feeds, chapter lists and transcripts (text of some kind), nothing else. */
const FEED_TYPES = /xml|rss|atom|json|text\/|vtt|srt|subrip/i
const HOUR = 60 * 60_000

/**
 * The outside services the app asks through this server, which caches their answers on disk for everyone: what one
 * listener looked up (an artist's concerts, biography, links) is there at once for the next, survives restarts, and
 * each service's request limits are kept centrally. Each only allows its own paths, so the relay is no open proxy.
 */
interface RelayService {
  base: string
  paths: RegExp
  /** The query parameter that carries the API key, and the server's own key (else the app's is used). */
  key?: { param: string; value?: string }
  /**
   * How long an answer stays fresh (by its status and what was asked); older ones are fetched again, and still served
   * if the service fails. What hardly changes (lyrics, biographies, links) is kept for months.
   */
  ttl: number | ((status: number, path: string, params: URLSearchParams) => number)
  /** Time between two calls (the service's rate limit). */
  spacing: number
  headers?: Record<string, string>
  /** Whether an answer is worth keeping (not a rate limit or an outage reported inside a 200). */
  keep?: (status: number, body: string) => boolean
}

const RELAY_SERVICES: Record<string, RelayService> = {
  // Ticketmaster's Discovery API: events, artists, venues. Five calls a second per key.
  concerts: {
    base: 'https://app.ticketmaster.com/discovery/v2/',
    paths: /^(events|attractions|venues)(\/[A-Za-z0-9_-]+)?(\.json)?$/,
    key: { param: 'apikey', value: process.env.TICKETMASTER_API_KEY?.trim() },
    ttl: 6 * HOUR,
    spacing: 220,
    keep: (status) => status < 400 || status === 404,
  },
  // Last.fm: artist info, top tracks, similar artists, charts. Its answers change slowly.
  lastfm: {
    base: 'https://ws.audioscrobbler.com/2.0/',
    paths: /^$/,
    key: { param: 'api_key', value: process.env.LASTFM_API_KEY?.trim() },
    // Charts move daily; an artist's biography, top tracks and similar artists hardly do.
    ttl: (_status, _path, params) => (/^artist\./.test(params.get('method') ?? '') ? 30 * 24 * HOUR : 24 * HOUR),
    spacing: 200,
    // Errors come inside a 200: "not found" (6) is an answer, being limited or down (8, 11, 16, 29) is not.
    keep: (status, body) => status < 400 && !/"error":\s*(8|11|16|29)\b/.test(body),
  },
  // MusicBrainz: an artist and their links. It asks for at most one call a second and a name for the caller.
  musicbrainz: {
    base: 'https://musicbrainz.org/ws/2/',
    paths: /^artist(\/[0-9a-f-]{36})?$/,
    ttl: 90 * 24 * HOUR,
    spacing: 1100,
    headers: { 'User-Agent': 'Lumio/1.0 (self-hosted Jellyfin client)' },
    keep: (status) => status < 400 || status === 404,
  },
  // lrclib: lyrics. A song's lyrics don't change: kept half a year; "none found" is asked again after a week.
  lyrics: {
    base: 'https://lrclib.net/',
    paths: /^api\/get$/,
    ttl: (status) => (status === 404 ? 7 * 24 * HOUR : 180 * 24 * HOUR),
    spacing: 100,
    headers: { 'User-Agent': 'Lumio/1.0 (self-hosted Jellyfin client)' },
    keep: (status) => status < 400 || status === 404,
  },
}

if (!JELLYFIN_URL) {
  console.error('JELLYFIN_URL is required, e.g. JELLYFIN_URL=https://jellyfin.example.org')
  process.exit(1)
}

const store = new Store(DATA_DIR)

// ---- authentication: the user's own Jellyfin token ----

const tokens = new Map<string, { person: Person; until: number }>()

async function authenticate(token: string | null): Promise<Person | null> {
  if (!token) return null
  const cached = tokens.get(token)
  if (cached && cached.until > Date.now()) return cached.person
  try {
    const response = await fetch(`${JELLYFIN_URL}/Users/Me`, { headers: { Authorization: `MediaBrowser Token="${token}"` } })
    if (!response.ok) return null
    const user = (await response.json()) as { Id: string; Name: string; PrimaryImageTag?: string | null }
    const person = { id: user.Id, name: user.Name, imageTag: user.PrimaryImageTag ?? null }
    store.upsertPerson(person)
    tokens.set(token, { person, until: Date.now() + TOKEN_TTL_MS })
    return person
  } catch {
    return null
  }
}

function tokenOf(request: IncomingMessage, url: URL) {
  const header = request.headers.authorization ?? ''
  return header.match(/Token="([^"]+)"/)?.[1] ?? (header.startsWith('Bearer ') ? header.slice(7) : null) ?? url.searchParams.get('token')
}

// ---- live updates (server-sent events) ----

const streams = new Map<string, Set<ServerResponse>>()

function push(userId: string, event: string, data: unknown) {
  for (const response of streams.get(userId) ?? []) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** Tells someone's friends what they play now (if they share it). */
function announceActivity(userId: string) {
  if (!store.privacy(userId).shareActivity) return
  const payload = { user: store.person(userId), activity: store.activity(userId) }
  for (const friend of store.friends(userId)) push(friend, 'activity', payload)
}

// ---- responses ----

function send(response: ServerResponse, status: number, body?: unknown) {
  response.writeHead(status, body === undefined ? {} : { 'Content-Type': 'application/json' })
  response.end(body === undefined ? undefined : JSON.stringify(body))
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > BODY_LIMIT) throw new Error('Body too large')
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T
}

function cors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin
  // The app normally comes from this server (same origin); other origins only when listed.
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.setHeader('Access-Control-Max-Age', '600')
}

/** Someone's profile as `viewer` may see it: lists only where the owner allows (always for themselves). */
function profileFor(viewer: string, id: string) {
  const own = viewer === id
  const privacy = store.privacy(id)
  const following = store.following(id)
  const followers = store.followers(id)
  const friend = store.follows(viewer, id) && store.follows(id, viewer)
  return {
    person: store.person(id) ?? { id, name: '', imageTag: null },
    privacy: own ? privacy : { showPlaylists: privacy.showPlaylists },
    followingCount: following.length,
    followerCount: followers.length,
    following: own || privacy.showFollowing ? store.people(following) : null,
    followers: own || privacy.showFollowers ? store.people(followers) : null,
    followsYou: store.follows(id, viewer),
    youFollow: store.follows(viewer, id),
    friend,
    activity: own || (friend && privacy.shareActivity) ? store.activity(id) : null,
  }
}

const PRIVACY_KEYS = Object.keys(DEFAULT_PRIVACY) as Array<keyof Privacy>

// ---- the web app ----

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
}

/** A file of the built app; every other address gets index.html (the app routes itself). */
async function serveApp(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405)
  const requested = normalize(join(WEB_DIR, decodeURIComponent(pathname)))
  // Never outside the app's folder.
  const inside = requested === WEB_DIR || requested.startsWith(WEB_DIR + sep)
  let file = inside ? requested : join(WEB_DIR, 'index.html')
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file')
  } catch {
    file = join(WEB_DIR, 'index.html')
  }
  try {
    const info = await stat(file)
    const hashed = pathname.startsWith('/assets/')
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // Built files carry a hash and never change; the page and the service worker are checked every time.
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    if (request.method === 'HEAD') return response.end()
    createReadStream(file).pipe(response)
  } catch {
    send(response, 404, { error: 'The app is not built (run pnpm build) or WEB_DIR is wrong' })
  }
}

/**
 * GET /api/image?url=…: a podcast cover, fetched once and then kept on disk. Browsers get it from the app's own origin
 * (with CORS), so it is cached like the app's other pictures, works offline and can be drawn (drag images, colours).
 */
async function serveImage(response: ServerResponse, source: string | null) {
  let target: URL
  try {
    target = new URL(source ?? '')
  } catch {
    return send(response, 400, { error: 'Bad url' })
  }
  if (target.protocol !== 'https:' || !IMAGE_HOSTS.test(target.hostname)) return send(response, 403, { error: 'Host not allowed' })
  const name = createHash('sha256').update(target.href).digest('hex')
  const file = join(IMAGE_DIR, name)
  const reply = (body: Buffer, type: string) => {
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': body.length,
      // The address names the picture; it never changes.
      'Cache-Control': 'public, max-age=2592000, immutable',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(body)
  }
  try {
    const [body, type] = await Promise.all([readFile(file), readFile(`${file}.type`, 'utf8')])
    return reply(body, type)
  } catch {
    // Not kept yet.
  }
  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(15_000) })
    const type = upstream.headers.get('content-type') ?? ''
    if (!upstream.ok || !type.startsWith('image/')) return send(response, 502, { error: 'Image unavailable' })
    const body = Buffer.from(await upstream.arrayBuffer())
    if (body.length > IMAGE_LIMIT) return send(response, 502, { error: 'Image too large' })
    await mkdir(IMAGE_DIR, { recursive: true })
    await Promise.all([writeFile(file, body), writeFile(`${file}.type`, type)])
    reply(body, type)
  } catch {
    send(response, 502, { error: 'Image unavailable' })
  }
}

/** When each service may be called next. */
const nextSlot = new Map<string, number>()
async function relaySlot(name: string, spacing: number) {
  const now = Date.now()
  const at = Math.max(now, nextSlot.get(name) ?? 0)
  nextSlot.set(name, at + spacing)
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now))
}

interface RelayEntry {
  at: number
  status: number
  type: string
  body: string
}

/** GET /api/relay/<service>/<path>?…: a service's answer, from the cache while it is fresh. */
async function serveRelay(response: ServerResponse, name: string, path: string, params: URLSearchParams) {
  const service = RELAY_SERVICES[name]
  if (!service || !service.paths.test(path)) return send(response, 404, { error: 'Unknown relay path' })
  const key = service.key ? service.key.value || params.get(service.key.param) : undefined
  if (service.key && !key) return send(response, 503, { error: `No ${name} key` })
  const query = new URLSearchParams([...params].filter(([param]) => param !== service.key?.param).sort(([a], [b]) => a.localeCompare(b)))
  const file = join(RELAY_DIR, name, createHash('sha256').update(`${path}?${query}`).digest('hex'))
  let cached: RelayEntry | null = null
  try {
    cached = JSON.parse(await readFile(file, 'utf8')) as RelayEntry
  } catch {
    // Not asked before.
  }
  const reply = (entry: RelayEntry) => {
    response.writeHead(entry.status, { 'Content-Type': entry.type, 'Cache-Control': 'private, max-age=3600' })
    response.end(entry.body)
  }
  const fresh = (entry: RelayEntry) => Date.now() - entry.at < (typeof service.ttl === 'number' ? service.ttl : service.ttl(entry.status, path, params))
  if (cached && fresh(cached)) return reply(cached)
  try {
    await relaySlot(name, service.spacing)
    if (service.key && key) query.set(service.key.param, key)
    const upstream = await fetch(`${service.base}${path}?${query}`, { headers: service.headers, signal: AbortSignal.timeout(15_000) })
    const entry: RelayEntry = { at: Date.now(), status: upstream.status, type: upstream.headers.get('content-type') ?? 'application/json', body: await upstream.text() }
    if (!(service.keep ?? ((status) => status < 400))(entry.status, entry.body)) {
      if (cached) return reply(cached)
      return send(response, 502, { error: `${name} ${upstream.status}` })
    }
    await mkdir(join(RELAY_DIR, name), { recursive: true })
    await writeFile(file, JSON.stringify(entry))
    reply(entry)
  } catch {
    if (cached) return reply(cached)
    send(response, 502, { error: `${name} unavailable` })
  }
}

/**
 * GET /api/feed?url=…: a podcast's RSS feed, or a chapter list or transcript it points to. Most feeds don't let
 * browsers read them; through here they can, and are kept on disk for everyone (feeds 6 h, the files they point to,
 * which don't change, 30 days). Signed-in users only, https only, text only and size-limited.
 */
async function serveFeed(response: ServerResponse, source: string | null) {
  let target: URL
  try {
    target = new URL(source ?? '')
  } catch {
    return send(response, 400, { error: 'Bad url' })
  }
  if (target.protocol !== 'https:') return send(response, 403, { error: 'Only https' })
  const file = join(RELAY_DIR, 'feeds', createHash('sha256').update(target.href).digest('hex'))
  let cached: RelayEntry | null = null
  try {
    cached = JSON.parse(await readFile(file, 'utf8')) as RelayEntry
  } catch {
    // Not asked before.
  }
  const reply = (entry: RelayEntry) => {
    response.writeHead(entry.status, { 'Content-Type': entry.type, 'Cache-Control': 'private, max-age=3600' })
    response.end(entry.body)
  }
  const ttl = (entry: RelayEntry) => (/xml|rss|atom/i.test(entry.type) ? 6 * HOUR : 30 * 24 * HOUR)
  if (cached && Date.now() - cached.at < ttl(cached)) return reply(cached)
  try {
    const upstream = await fetch(target, { headers: { 'User-Agent': 'Lumio/1.0 (self-hosted Jellyfin client)' }, signal: AbortSignal.timeout(20_000) })
    const type = upstream.headers.get('content-type') ?? 'application/octet-stream'
    const length = Number(upstream.headers.get('content-length') ?? 0)
    if (!upstream.ok || !FEED_TYPES.test(type) || length > FEED_LIMIT) {
      if (cached) return reply(cached)
      return send(response, 502, { error: 'Feed unavailable' })
    }
    const body = await upstream.text()
    if (body.length > FEED_LIMIT) return send(response, 502, { error: 'Feed too large' })
    const entry: RelayEntry = { at: Date.now(), status: 200, type, body }
    await mkdir(join(RELAY_DIR, 'feeds'), { recursive: true })
    await writeFile(file, JSON.stringify(entry))
    reply(entry)
  } catch {
    if (cached) return reply(cached)
    send(response, 502, { error: 'Feed unavailable' })
  }
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  // Everything outside /api is the app.
  if (!url.pathname.startsWith('/api/') && url.pathname !== '/api') return serveApp(request, response, url.pathname)

  cors(request, response)
  if (request.method === 'OPTIONS') return send(response, 204)
  const path = url.pathname.slice(4).replace(/\/+$/, '') || '/'
  if (path === '/health') return send(response, 200, { ok: true })
  // Pictures load from <img> tags, which carry no token; the host list keeps this to podcast covers.
  if (path === '/image' && request.method === 'GET') return serveImage(response, url.searchParams.get('url'))

  const me = await authenticate(tokenOf(request, url))
  if (!me) return send(response, 401, { error: 'Not signed in' })

  // GET /feed?url=…: podcast feeds and the files they point to.
  if (path === '/feed' && request.method === 'GET') return serveFeed(response, url.searchParams.get('url'))

  // GET /relay/<service>/…: outside services, relayed and cached (for signed-in users only, as it may use the server's
  // keys). /concerts/… is the older address of the Ticketmaster relay.
  if (request.method === 'GET' && (path.startsWith('/relay/') || path.startsWith('/concerts/'))) {
    const [name = '', ...rest] = path.startsWith('/concerts/') ? ['concerts', path.slice('/concerts/'.length)] : path.slice('/relay/'.length).split(/\/(.*)/s)
    return serveRelay(response, name, rest.join(''), url.searchParams)
  }

  // GET /me: the user's own follows and privacy.
  if (path === '/me' && request.method === 'GET') {
    return send(response, 200, { ...profileFor(me.id, me.id), friends: store.people(store.friends(me.id)) })
  }

  // GET /me/settings: the user's settings that follow the account (theme of the player, subtitles, concert location …).
  if (path === '/me/settings' && request.method === 'GET') return send(response, 200, store.settings(me.id))

  // PATCH /me/settings { key: value | null }: changes some; the user's other devices hear of it at once.
  if (path === '/me/settings' && request.method === 'PATCH') {
    const patch = await readJson<Record<string, unknown>>(request)
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return send(response, 400, { error: 'Expected an object' })
    const settings = store.updateSettings(me.id, patch)
    push(me.id, 'settings', settings)
    return send(response, 200, settings)
  }

  // PUT /me/privacy
  if (path === '/me/privacy' && request.method === 'PUT') {
    const body = await readJson<Partial<Privacy>>(request)
    const change = Object.fromEntries(PRIVACY_KEYS.filter((key) => typeof body[key] === 'boolean').map((key) => [key, body[key]]))
    const privacy = store.setPrivacy(me.id, change)
    if (!privacy.shareActivity) for (const friend of store.friends(me.id)) push(friend, 'activity', { user: me, activity: null })
    return send(response, 200, privacy)
  }

  // POST /me/follows/import { ids }: follows kept by Lumio before the server existed.
  if (path === '/me/follows/import' && request.method === 'POST') {
    const { ids = [] } = await readJson<{ ids?: string[] }>(request)
    for (const id of ids.slice(0, 500)) if (typeof id === 'string' && /^[0-9a-f-]{32,36}$/i.test(id)) store.follow(me.id, id)
    return send(response, 204)
  }

  // PUT/DELETE /follows/:id
  const follow = path.match(/^\/follows\/([0-9a-f-]{32,36})$/i)
  if (follow && (request.method === 'PUT' || request.method === 'DELETE')) {
    const target = follow[1]!
    if (request.method === 'PUT') {
      store.follow(me.id, target)
      push(target, 'follow', { user: me })
    } else store.unfollow(me.id, target)
    return send(response, 200, profileFor(me.id, target))
  }

  // GET /users/:id
  const user = path.match(/^\/users\/([0-9a-f-]{32,36})$/i)
  if (user && request.method === 'GET') return send(response, 200, profileFor(me.id, user[1]!))

  // GET /friends/activity: what friends play (those who share it), newest first.
  if (path === '/friends/activity' && request.method === 'GET') {
    const list = store
      .friends(me.id)
      .filter((id) => store.privacy(id).shareActivity)
      .map((id) => ({ user: store.person(id), activity: store.activity(id) }))
      .filter((entry) => entry.user && entry.activity)
      .sort((a, b) => b.activity!.at - a.activity!.at)
    return send(response, 200, list)
  }

  // POST /me/activity: what the user plays now (or null when they stop).
  if (path === '/me/activity' && request.method === 'POST') {
    const body = await readJson<Partial<Activity> | null>(request)
    if (!body?.itemId) {
      const last = store.activity(me.id)
      if (last) store.setActivity(me.id, { ...last, playing: false, at: Date.now() })
    } else {
      store.setActivity(me.id, {
        itemId: String(body.itemId).slice(0, 64),
        name: String(body.name ?? '').slice(0, 300),
        subtitle: body.subtitle ? String(body.subtitle).slice(0, 300) : undefined,
        context: body.context ? String(body.context).slice(0, 300) : undefined,
        contextId: body.contextId ? String(body.contextId).slice(0, 64) : undefined,
        kind: body.kind === 'video' ? 'video' : 'audio',
        playing: body.playing !== false,
        at: Date.now(),
      })
    }
    announceActivity(me.id)
    return send(response, 204)
  }

  // GET /events?token=…: live updates (friends' activity, new followers).
  if (path === '/events' && request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    response.write(': connected\n\n')
    const set = streams.get(me.id) ?? new Set()
    set.add(response)
    streams.set(me.id, set)
    // A comment now and then keeps proxies from closing a quiet connection.
    const keepAlive = setInterval(() => response.write(': ping\n\n'), 25_000)
    request.on('close', () => {
      clearInterval(keepAlive)
      set.delete(response)
    })
    return
  }

  send(response, 404, { error: 'Not found' })
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(error)
    if (!response.headersSent) send(response, 500, { error: 'Server error' })
    else response.end()
  })
}).listen(PORT, () => console.log(`Lumio on :${PORT} (app from ${WEB_DIR}), Jellyfin at ${JELLYFIN_URL}`))
