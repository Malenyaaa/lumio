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
 * TICKETMASTER_API_KEY (optional; otherwise the app's own key is used for concerts).
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
const CONCERT_DIR = join(DATA_DIR, 'concerts')
const TICKETMASTER_KEY = process.env.TICKETMASTER_API_KEY?.trim()
/** Concert answers are fresh this long; older ones are fetched again (and still served if Ticketmaster fails). */
const CONCERT_TTL_MS = 6 * 60 * 60_000
/** What the relay asks Ticketmaster's Discovery API for: events, artists and venues. */
const CONCERT_PATHS = /^(events|attractions|venues)(\/[A-Za-z0-9_-]+)?(\.json)?$/

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

/** Ticketmaster allows five requests a second for a key; the relay spaces its calls out to stay under it. */
let nextTicketmasterSlot = 0
async function ticketmasterSlot() {
  const now = Date.now()
  const wait = Math.max(0, nextTicketmasterSlot - now)
  nextTicketmasterSlot = Math.max(now, nextTicketmasterSlot) + 220
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
}

/**
 * GET /api/concerts/<path>?…: Ticketmaster's Discovery API, cached on disk for everyone. An artist's shows are fetched
 * once every few hours however many people open the artist, and the answers survive restarts.
 */
async function serveConcerts(response: ServerResponse, path: string, params: URLSearchParams) {
  if (!CONCERT_PATHS.test(path)) return send(response, 404, { error: 'Unknown concert path' })
  const key = TICKETMASTER_KEY || params.get('apikey')
  if (!key) return send(response, 503, { error: 'No Ticketmaster key' })
  const query = new URLSearchParams([...params].filter(([name]) => name !== 'apikey').sort(([a], [b]) => a.localeCompare(b)))
  const file = join(CONCERT_DIR, createHash('sha256').update(`${path}?${query}`).digest('hex'))
  let cached: { at: number; status: number; body: string } | null = null
  try {
    cached = JSON.parse(await readFile(file, 'utf8')) as { at: number; status: number; body: string }
  } catch {
    // Not asked before.
  }
  const reply = (entry: { status: number; body: string }) => {
    response.writeHead(entry.status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' })
    response.end(entry.body)
  }
  if (cached && Date.now() - cached.at < CONCERT_TTL_MS) return reply(cached)
  try {
    await ticketmasterSlot()
    query.set('apikey', key)
    const upstream = await fetch(`https://app.ticketmaster.com/discovery/v2/${path}?${query}`, { signal: AbortSignal.timeout(15_000) })
    // Answers worth keeping: found, or "no such event" (404); limits and failures are not.
    if (!upstream.ok && upstream.status !== 404) {
      if (cached) return reply(cached)
      return send(response, 502, { error: `Ticketmaster ${upstream.status}` })
    }
    const entry = { at: Date.now(), status: upstream.status, body: await upstream.text() }
    await mkdir(CONCERT_DIR, { recursive: true })
    await writeFile(file, JSON.stringify(entry))
    reply(entry)
  } catch {
    if (cached) return reply(cached)
    send(response, 502, { error: 'Ticketmaster unavailable' })
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

  // GET /concerts/…: concert data, relayed and cached (for signed-in users only, as it may use the server's key).
  if (path.startsWith('/concerts/') && request.method === 'GET') return serveConcerts(response, path.slice('/concerts/'.length), url.searchParams)

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
