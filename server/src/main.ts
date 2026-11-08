import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { isIP, type Socket } from 'node:net'
import { Readable } from 'node:stream'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { isJellyfinRequest, proxyToJellyfin, proxyUpgrade } from './proxy.ts'
import { creditsOfRecording, lookupCredits, sameName, searchRecordings, type Failure, type JobState, type TrackCredits, type TrackMeta } from './credits.ts'
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
 * LASTFM_API_KEY, TICKETMASTER_API_KEY and TMDB_API_KEY (optional: the keys for those services, which the app then asks
 * through this server; an app built with keys of its own can use those instead), MUSICBRAINZ_CONTACT (optional;
 * how MusicBrainz can reach the operator), PROXY_JELLYFIN (true: Lumio is the public face and passes everything of
 * Jellyfin's through, see proxy.ts), SSO_PROVIDERS (the SSO plugin's providers for the sign-in page, as
 * `name:Button label` separated by commas, e.g. `authentik:Sign in with Nauren`), DISABLE_PASSWORD_LOGIN (true: the
 * sign-in page offers SSO and Quick Connect only, no Jellyfin password form; only with SSO providers set).
 */
const JELLYFIN_URL = (process.env.JELLYFIN_URL ?? '').replace(/\/+$/, '')
const PROXY_JELLYFIN = /^(1|true|yes)$/i.test(process.env.PROXY_JELLYFIN ?? '')
/** Signing in with a Jellyfin password is left off Lumio's sign-in page (SSO and Quick Connect only). */
const DISABLE_PASSWORD_LOGIN = /^(1|true|yes)$/i.test(process.env.DISABLE_PASSWORD_LOGIN ?? '')
const SSO_PROVIDERS = (process.env.SSO_PROVIDERS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [id = '', ...label] = entry.split(':')
    return { id: id.trim(), label: label.join(':').trim() || id.trim() }
  })
  .filter((provider) => /^[\w.-]+$/.test(provider.id))
const PORT = Number(process.env.PORT ?? 8097)
const DATA_DIR = process.env.DATA_DIR ?? './data'
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
const WEB_DIR = resolve(process.env.WEB_DIR ?? join(import.meta.dirname, '../../dist'))
/** A token is checked with Jellyfin again after this long. */
const TOKEN_TTL_MS = 5 * 60_000
/** Largest request body accepted (bytes). */
const BODY_LIMIT = 16 * 1024
/** Hosts whose pictures the image relay fetches (podcast covers from Apple, artist photos from Deezer); nothing else, so it is no open proxy. */
const IMAGE_HOSTS = /(^|\.)(mzstatic\.com|dzcdn\.net|epidemicsound\.com)$/
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
 * How the server introduces itself to outside services. MusicBrainz asks for a way to reach whoever runs a client and
 * turns anonymous ones away sooner; MUSICBRAINZ_CONTACT (a URL or e-mail address) names the operator.
 */
const USER_AGENT = `Lumio/1.0 ( ${process.env.MUSICBRAINZ_CONTACT?.trim() || 'https://github.com/PalmarHealer/lumio'} )`

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
  // TMDb: a film's or series' rating, and a film collection's parts. Ratings move slowly.
  tmdb: {
    base: 'https://api.themoviedb.org/3/',
    paths: /^(movie|tv|collection)\/\d+$/,
    key: { param: 'api_key', value: process.env.TMDB_API_KEY?.trim() },
    ttl: 7 * 24 * HOUR,
    spacing: 50,
    keep: (status) => status < 400 || status === 404,
  },
  // Last.fm: artist info, top tracks, similar artists, charts. Its answers change slowly.
  lastfm: {
    base: 'https://ws.audioscrobbler.com/2.0/',
    paths: /^$/,
    key: { param: 'api_key', value: process.env.LASTFM_API_KEY?.trim() },
    // Charts move daily; an artist's biography, top tracks and similar artists hardly do.
    ttl: (_status, _path, params) => (/^artist\./.test(params.get('method') ?? '') ? 90 * 24 * HOUR : 24 * HOUR),
    spacing: 200,
    // Errors come inside a 200: "not found" (6) is an answer, being limited or down (8, 11, 16, 29) is not.
    keep: (status, body) => status < 400 && !/"error":\s*(8|11|16|29)\b/.test(body),
  },
  // MusicBrainz: an artist and their links, a recording's credits and its label. It asks for at most one call a second and a name for the caller.
  musicbrainz: {
    base: 'https://musicbrainz.org/ws/2/',
    paths: /^(artist|recording|release)(\/[0-9a-f-]{36})?$/,
    ttl: 180 * 24 * HOUR,
    spacing: 1100,
    headers: { 'User-Agent': USER_AGENT },
    keep: (status) => status < 400 || status === 404,
  },
  // Deezer: a photo for artists Jellyfin has none for (its search needs no key). Photos rarely change.
  deezer: {
    base: 'https://api.deezer.com/',
    paths: /^search\/artist$/,
    ttl: 180 * 24 * HOUR,
    spacing: 120,
  },
  // lrclib: lyrics. A song's lyrics don't change: kept half a year; "none found" is asked again after a week.
  lyrics: {
    base: 'https://lrclib.net/',
    paths: /^api\/get$/,
    ttl: (status) => (status === 404 ? 7 * 24 * HOUR : 180 * 24 * HOUR),
    spacing: 100,
    headers: { 'User-Agent': USER_AGENT },
    keep: (status) => status < 400 || status === 404,
  },
}

if (!JELLYFIN_URL) {
  console.error('JELLYFIN_URL is required, e.g. JELLYFIN_URL=https://jellyfin.example.org')
  process.exit(1)
}

const store = new Store(DATA_DIR)

// ---- authentication: the user's own Jellyfin token ----

const tokens = new Map<string, { person: Person; admin: boolean; until: number }>()

async function authenticate(token: string | null): Promise<Person | null> {
  if (!token) return null
  const cached = tokens.get(token)
  if (cached && cached.until > Date.now()) return cached.person
  try {
    const response = await fetch(`${JELLYFIN_URL}/Users/Me`, { headers: { Authorization: `MediaBrowser Token="${token}"` } })
    if (!response.ok) return null
    const user = (await response.json()) as { Id: string; Name: string; PrimaryImageTag?: string | null; Policy?: { IsAdministrator?: boolean } }
    const person = { id: user.Id, name: user.Name, imageTag: user.PrimaryImageTag ?? null }
    store.upsertPerson(person)
    tokens.set(token, { person, admin: !!user.Policy?.IsAdministrator, until: Date.now() + TOKEN_TTL_MS })
    return person
  } catch {
    return null
  }
}

/** Whether the token belongs to a Jellyfin administrator (checked by authenticate). */
function isAdmin(token: string | null) {
  return !!token && !!tokens.get(token)?.admin
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
/** Whether the built app has a file at this path (not just its page, which every app address is). */
async function isAppFile(pathname: string) {
  if (pathname === '/' || pathname.endsWith('/')) return false
  const file = normalize(join(WEB_DIR, decodeURIComponent(pathname)))
  if (!file.startsWith(WEB_DIR + sep)) return false
  return stat(file).then((info) => info.isFile()).catch(() => false)
}

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
class ImageError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** A picture from an allowed host, kept on disk (fetched the first time); throws an ImageError otherwise. */
async function keptImage(source: string | null): Promise<{ body: Buffer; type: string }> {
  let target: URL
  try {
    target = new URL(source ?? '')
  } catch {
    throw new ImageError(400, 'Bad url')
  }
  if (target.protocol !== 'https:' || !IMAGE_HOSTS.test(target.hostname)) throw new ImageError(403, 'Host not allowed')
  const file = join(IMAGE_DIR, createHash('sha256').update(target.href).digest('hex'))
  try {
    const [body, type] = await Promise.all([readFile(file), readFile(`${file}.type`, 'utf8')])
    return { body, type }
  } catch {
    // Not kept yet.
  }
  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(15_000) })
    const type = upstream.headers.get('content-type') ?? ''
    if (!upstream.ok || !type.startsWith('image/')) throw new ImageError(502, 'Image unavailable')
    const body = Buffer.from(await upstream.arrayBuffer())
    if (body.length > IMAGE_LIMIT) throw new ImageError(502, 'Image too large')
    await mkdir(IMAGE_DIR, { recursive: true })
    await Promise.all([writeFile(file, body), writeFile(`${file}.type`, type)])
    return { body, type }
  } catch (error) {
    throw error instanceof ImageError ? error : new ImageError(502, 'Image unavailable')
  }
}

async function serveImage(response: ServerResponse, source: string | null) {
  try {
    const { body, type } = await keptImage(source)
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': body.length,
      // The address names the picture; it never changes.
      'Cache-Control': 'public, max-age=2592000, immutable',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(body)
  } catch (error) {
    send(response, error instanceof ImageError ? error.status : 502, { error: error instanceof Error ? error.message : 'Image unavailable' })
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

class RelayError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** A service's answer, from the cache while it is fresh (and when the service fails); throws a RelayError otherwise. */
async function relayGet(name: string, path: string, params: URLSearchParams): Promise<RelayEntry> {
  const service = RELAY_SERVICES[name]
  if (!service || !service.paths.test(path)) throw new RelayError(404, 'Unknown relay path')
  const key = service.key ? service.key.value || params.get(service.key.param) : undefined
  if (service.key && !key) throw new RelayError(503, `No ${name} key`)
  const query = new URLSearchParams([...params].filter(([param]) => param !== service.key?.param).sort(([a], [b]) => a.localeCompare(b)))
  const file = join(RELAY_DIR, name, createHash('sha256').update(`${path}?${query}`).digest('hex'))
  let cached: RelayEntry | null = null
  try {
    cached = JSON.parse(await readFile(file, 'utf8')) as RelayEntry
  } catch {
    // Not asked before.
  }
  const fresh = (entry: RelayEntry) => Date.now() - entry.at < (typeof service.ttl === 'number' ? service.ttl : service.ttl(entry.status, path, params))
  if (cached && fresh(cached)) return cached
  try {
    if (service.key && key) query.set(service.key.param, key)
    let upstream: Response
    // Turned away (too many calls, or the service is busy): everyone waits a little longer, then this is asked again.
    for (let attempt = 0; ; attempt++) {
      await relaySlot(name, service.spacing)
      upstream = await fetch(`${service.base}${path}?${query}`, { headers: service.headers, signal: AbortSignal.timeout(15_000) })
      if ((upstream.status !== 503 && upstream.status !== 429) || attempt >= 3) break
      nextSlot.set(name, Math.max(nextSlot.get(name) ?? 0, Date.now()) + 2_000 * (attempt + 1))
    }
    const entry: RelayEntry = { at: Date.now(), status: upstream.status, type: upstream.headers.get('content-type') ?? 'application/json', body: await upstream.text() }
    if (!(service.keep ?? ((status) => status < 400))(entry.status, entry.body)) {
      if (cached) return cached
      throw new RelayError(502, `${name} ${upstream.status}`)
    }
    await mkdir(join(RELAY_DIR, name), { recursive: true })
    await writeFile(file, JSON.stringify(entry))
    return entry
  } catch (error) {
    if (cached) return cached
    throw error instanceof RelayError ? error : new RelayError(502, `${name} unavailable`)
  }
}

/** GET /api/relay/<service>/<path>?…: a service's answer, from the cache while it is fresh. */
async function serveRelay(response: ServerResponse, name: string, path: string, params: URLSearchParams) {
  try {
    const entry = await relayGet(name, path, params)
    response.writeHead(entry.status, { 'Content-Type': entry.type, 'Cache-Control': 'private, max-age=3600' })
    response.end(entry.body)
  } catch (error) {
    send(response, error instanceof RelayError ? error.status : 502, { error: error instanceof Error ? error.message : 'Relay failed' })
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
    const upstream = await fetch(target, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) })
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

/** Whether an address is inside a private network (or this machine), which the audio relay never fetches from. */
async function isPrivateHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return true
  let addresses: string[]
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address)
  } catch {
    return true
  }
  return addresses.some((address) =>
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(address) ||
    /^(::1$|::$|f[cd]|fe80:|::ffff:(127|10|192\.168)\.)/i.test(address),
  )
}

/** Largest podcast episode relayed (bytes). */
const EPISODE_LIMIT = 1024 * 1024 * 1024

/**
 * GET /api/podcast-audio?url=…: a podcast episode's audio file, passed through (not kept), for downloading it: most
 * podcast hosts don't let browsers read their files, and some still serve plain http. Signed-in users only, audio only,
 * size-limited, and never into private networks (each redirect is checked).
 */
async function servePodcastAudio(request: IncomingMessage, response: ServerResponse, source: string | null) {
  let target: URL
  try {
    target = new URL(source ?? '')
  } catch {
    return send(response, 400, { error: 'Bad url' })
  }
  try {
    let upstream: Response | null = null
    // Podcast links usually go through a few tracking redirects; each hop is checked before it is followed.
    for (let hop = 0; hop < 8; hop++) {
      if ((target.protocol !== 'https:' && target.protocol !== 'http:') || (await isPrivateHost(target.hostname))) return send(response, 403, { error: 'Not allowed' })
      const answer = await fetch(target, { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual', signal: AbortSignal.timeout(30_000) })
      const next = answer.status >= 300 && answer.status < 400 ? answer.headers.get('location') : null
      if (!next) {
        upstream = answer
        break
      }
      target = new URL(next, target)
    }
    if (!upstream?.ok || !upstream.body) return send(response, 502, { error: 'Episode unavailable' })
    const type = upstream.headers.get('content-type') ?? ''
    const length = Number(upstream.headers.get('content-length') ?? 0)
    if (!/^(audio\/|video\/mp4|application\/octet-stream)/i.test(type) || length > EPISODE_LIMIT) return send(response, 502, { error: 'Not an episode' })
    response.writeHead(200, { 'Content-Type': type, ...(length ? { 'Content-Length': String(length) } : {}), 'Cache-Control': 'private, no-store' })
    let sent = 0
    const stream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream<Uint8Array>)
    request.on('close', () => stream.destroy())
    for await (const chunk of stream) {
      sent += (chunk as Buffer).length
      if (sent > EPISODE_LIMIT) break
      response.write(chunk)
    }
    response.end()
  } catch {
    if (!response.headersSent) send(response, 502, { error: 'Episode unavailable' })
    else response.destroy()
  }
}

interface ArtistProfile {
  name: string
  description?: string
  image?: string
}

/**
 * GET /api/artist-profile/epidemic?name=…: an artist's profile on Epidemic Sound (description and photo), for artists
 * who publish there. Epidemic has no public API; its artist pages carry the profile as structured data (schema.org),
 * which is read and kept: asked again after 90 days (a miss after 14), and kept when the site fails. Only the artist's
 * page by name, nothing else.
 */
async function epidemicProfile(name: string | null): Promise<ArtistProfile | null> {
  const slug = (name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug || slug.length > 80) throw new RelayError(400, 'Bad name')
  const file = join(RELAY_DIR, 'epidemic', `${slug}.json`)
  let cached: { at: number; profile: ArtistProfile | null } | null = null
  try {
    cached = JSON.parse(await readFile(file, 'utf8')) as { at: number; profile: ArtistProfile | null }
  } catch {
    // Not asked before.
  }
  // Profiles change rarely: asked again after 90 days (a miss after 14); kept for good meanwhile.
  if (cached && Date.now() - cached.at < (cached.profile ? 90 : 14) * 24 * HOUR) return cached.profile
  try {
    await relaySlot('epidemic', 600)
    const page = await fetch(`https://www.epidemicsound.com/artists/${slug}/`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    })
    let profile: ArtistProfile | null = null
    if (page.ok) {
      const html = await page.text()
      // The page's schema.org data names the artist (a MusicGroup) and describes them.
      for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
          const data = JSON.parse(match[1]!) as { mainEntity?: { '@type'?: string; name?: string; description?: string } }
          const entity = data.mainEntity
          if (entity?.['@type'] === 'MusicGroup' && entity.name) profile = { name: entity.name, description: entity.description?.trim() || undefined }
        } catch {
          // Not this one.
        }
      }
      const image = html.match(/https:\/\/cdn\.epidemicsound\.com\/curation-assets\/artist-profile-images\/[0-9a-f-]+\/original\.jpg/)?.[0]
      if (profile && image) profile.image = image
    } else if (page.status !== 404) {
      // The site is down or blocks us: what was found before beats nothing.
      if (cached) return cached.profile
      throw new RelayError(502, 'Epidemic Sound unavailable')
    }
    // A page that no longer carries a profile (the site changed): keep the one found before.
    if (!profile && cached?.profile && page.ok) return cached.profile
    await mkdir(join(RELAY_DIR, 'epidemic'), { recursive: true })
    await writeFile(file, JSON.stringify({ at: Date.now(), profile }))
    return profile
  } catch (error) {
    if (cached) return cached.profile
    throw error instanceof RelayError ? error : new RelayError(502, 'Epidemic Sound unavailable')
  }
}

async function serveEpidemicProfile(response: ServerResponse, name: string | null) {
  try {
    const profile = await epidemicProfile(name)
    send(response, profile ? 200 : 404, profile ?? { error: 'Not on Epidemic Sound' })
  } catch (error) {
    send(response, error instanceof RelayError ? error.status : 502, { error: error instanceof Error ? error.message : 'Epidemic Sound unavailable' })
  }
}

// ---- track credits (MusicBrainz), looked up once per track and kept for everyone ----

/** A MusicBrainz call through the relay: the answer, null when MusicBrainz has nothing; throws when it can't answer. */
async function musicbrainz(path: string, query: Record<string, string>): Promise<unknown> {
  const entry = await relayGet('musicbrainz', path, new URLSearchParams({ ...query, fmt: 'json' }))
  return entry.status < 400 ? (JSON.parse(entry.body) as unknown) : null
}

/** Lookups under way, so a track asked for twice at once is looked up once. */
const creditLookups = new Map<string, Promise<TrackCredits | null>>()

/** A track's credits: stored, or looked up now (a miss is asked again after 30 days). Throws when MusicBrainz fails. */
async function creditsFor(id: string, meta: TrackMeta): Promise<TrackCredits | null> {
  const stored = store.trackCredits([id])[id]
  if (stored && (stored.data || Date.now() - stored.at < 30 * 24 * HOUR)) return stored.data as TrackCredits | null
  const running = creditLookups.get(id)
  if (running) return running
  const lookup = lookupCredits(meta, musicbrainz)
    .then((credits) => {
      store.setTrackCredits(id, credits, meta)
      return credits
    })
    .finally(() => creditLookups.delete(id))
  creditLookups.set(id, lookup)
  return lookup
}

type JobName = 'credits' | 'artists'

/** The administrators' tasks on the library, each running on its own (one run at a time). */
const jobs: Record<JobName, JobState & { stop?: boolean }> = {
  credits: { running: false, total: 0, done: 0, found: 0, failed: 0, failures: [] },
  artists: { running: false, total: 0, done: 0, found: 0, failed: 0, failures: [] },
}

/**
 * Everything of a kind in some libraries (all when none are named), read with an administrator's token; each entry
 * once, even when it is in several of them.
 */
async function libraryItems<T extends { Id: string }>(token: string, userId: string, path: string, query: Record<string, string>, libraries?: string[]): Promise<T[]> {
  const items = new Map<string, T>()
  for (const parent of libraries?.length ? libraries : [undefined]) {
    let read = 0
    for (let start = 0; ; start += 500) {
      const params = new URLSearchParams({ ...query, ...(parent ? { ParentId: parent } : {}), StartIndex: String(start), Limit: '500', EnableImages: 'false', EnableUserData: 'false' })
      const response = await fetch(`${JELLYFIN_URL}${path.replace('{user}', userId)}?${params}`, { headers: { Authorization: `MediaBrowser Token="${token}"` } })
      if (!response.ok) throw new Error(`Jellyfin ${response.status}`)
      const page = (await response.json()) as { Items?: T[]; TotalRecordCount?: number }
      for (const item of page.Items ?? []) items.set(item.Id, item)
      read += page.Items?.length ?? 0
      if (!page.Items?.length || read >= (page.TotalRecordCount ?? 0)) break
    }
  }
  return [...items.values()]
}

/**
 * Runs a task over a list: each entry once (once more after a pause when a service turned it away), counting what was
 * found, keeping what failed. The administrator's token is held only while it runs.
 */
async function runJob<T>(job: JobState & { stop?: boolean }, load: () => Promise<T[]>, each: (item: T) => Promise<boolean>, describe: (item: T) => Omit<Failure, 'error'>) {
  Object.assign(job, { running: true, stop: false, total: 0, done: 0, found: 0, failed: 0, failures: [], startedAt: Date.now(), finishedAt: undefined, error: undefined })
  try {
    const items = await load()
    job.total = items.length
    for (const item of items) {
      if (job.stop) break
      for (let attempt = 0; ; attempt++) {
        try {
          if (await each(item)) job.found++
          break
        } catch (error) {
          if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 10_000))
            continue
          }
          const failure = { ...describe(item), error: error instanceof Error ? error.message : String(error) }
          console.warn(`${failure.title}${failure.artist ? ` (${failure.artist})` : ''}: ${failure.error}`)
          job.failures.push(failure)
          job.failed++
          break
        }
      }
      job.done++
    }
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'Failed'
  } finally {
    job.running = false
    job.finishedAt = Date.now()
  }
}

type Track = { Id: string; Name?: string; Artists?: string[]; AlbumArtist?: string; Album?: string; AlbumId?: string; RunTimeTicks?: number; Genres?: string[] }
type Artist = { Id: string; Name?: string; ProviderIds?: Record<string, string>; Genres?: string[] }

/** What the tasks go through: some libraries (all when none are named), without some artists and genres. */
interface Scope {
  libraries?: string[]
  /** Artist names whose tracks (as artist or album artist) are left out. */
  artists: string[]
  genres: string[]
}

const NO_SCOPE: Scope = { artists: [], genres: [] }

/** Whether a track or artist is left out by the scope's artists or genres. */
function leftOut(scope: Scope, names: Array<string | undefined>, genres: string[] | undefined) {
  return names.some((name) => scope.artists.some((excluded) => sameName(excluded, name))) || (genres ?? []).some((genre) => scope.genres.some((excluded) => sameName(excluded, genre)))
}

const trackMeta = (track: Track): TrackMeta => ({
  title: track.Name!,
  artist: track.Artists?.[0] ?? track.AlbumArtist!,
  album: track.Album,
  albumId: track.AlbumId,
  seconds: track.RunTimeTicks ? track.RunTimeTicks / 10_000_000 : undefined,
})

/** Looks up the credits of every track that wasn't yet (about three seconds a track, at MusicBrainz's pace). */
function scanCredits(token: string, userId: string, scope: Scope = NO_SCOPE) {
  return runJob<Track>(
    jobs.credits,
    async () => {
      const tracks = await libraryItems<Track>(token, userId, '/Users/{user}/Items', { Recursive: 'true', IncludeItemTypes: 'Audio', Fields: 'Genres' }, scope.libraries)
      const known = store.trackCredits(tracks.map((track) => track.Id))
      return tracks.filter(
        (track) => !known[track.Id] && track.Name && (track.Artists?.[0] ?? track.AlbumArtist) && !leftOut(scope, [...(track.Artists ?? []), track.AlbumArtist], track.Genres),
      )
    },
    async (track) => !!(await creditsFor(track.Id, trackMeta(track))),
    (track) => ({ id: track.Id, title: track.Name ?? '', artist: track.Artists?.[0] ?? track.AlbumArtist ?? '', album: track.Album, albumId: track.AlbumId }),
  )
}

/**
 * Fetches everything the app shows about an artist into the caches, exactly as the app asks for it (so its next look is
 * answered at once): Last.fm's biography (German and English), top tracks and similar artists, the Epidemic Sound
 * profile, the Deezer photo, the MusicBrainz links, and the photos themselves. Each service on its own; what failed is
 * named in `failed`.
 */
async function precacheArtist(artist: Artist, lastfmKey: string | undefined): Promise<{ found: boolean; failed: string[] }> {
  const lastfm = async (params: Record<string, string>) => {
    const entry = await relayGet('lastfm', '', new URLSearchParams({ ...params, ...(lastfmKey ? { api_key: lastfmKey } : {}), format: 'json', autocorrect: '1' }))
    return entry.body ? (JSON.parse(entry.body) as { error?: number; artist?: { bio?: { content?: string } } }) : null
  }
    const name = artist.Name ?? ''
    if (!name) return { found: false, failed: [] }
    let found = false
    const failed: string[] = []
    // Each service on its own: one that fails doesn't keep the others from being fetched.
    const step = async (service: string, run: () => Promise<void>) => {
      try {
        await run()
      } catch (error) {
        failed.push(`${service}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const json = <T,>(entry: RelayEntry) => (entry.body ? (JSON.parse(entry.body) as T) : null)
    if (lastfmKey || process.env.LASTFM_API_KEY) {
      await step('Last.fm', async () => {
        const info = await lastfm({ method: 'artist.getinfo', artist: name, lang: 'de' })
        found ||= !!info?.artist?.bio?.content
        await lastfm({ method: 'artist.getinfo', artist: name, lang: 'en' })
        await lastfm({ method: 'artist.gettoptracks', artist: name, limit: '50' })
        await lastfm({ method: 'artist.getsimilar', artist: name, limit: '30' })
      })
    }
    await step('Epidemic Sound', async () => {
      const profile = await epidemicProfile(name)
      if (profile?.image) await keptImage(profile.image)
      found ||= !!profile?.description
    })
    await step('Deezer', async () => {
      const deezer = json<{ data?: Array<{ name: string; picture_xl?: string; picture_big?: string }> }>(
        await relayGet('deezer', 'search/artist', new URLSearchParams({ q: name, limit: '5' })),
      )
      const match = deezer?.data?.find((entry) => sameName(entry.name, name))
      const picture = match?.picture_xl ?? match?.picture_big
      if (picture && !picture.includes('/artist//')) await keptImage(picture)
    })
    await step('MusicBrainz', async () => {
      let id = artist.ProviderIds?.MusicBrainzArtist
      if (!id) {
        const search = json<{ artists?: Array<{ id: string; name: string; score: number }> }>(
          await relayGet('musicbrainz', 'artist', new URLSearchParams({ query: `artist:"${name}"`, fmt: 'json', limit: '3' })),
        )
        id = search?.artists?.find((entry) => entry.score >= 95 && sameName(entry.name, name))?.id
      }
      if (id) await relayGet('musicbrainz', `artist/${id}`, new URLSearchParams({ inc: 'url-rels', fmt: 'json' }))
    })
    return { found, failed }
}

/** Fetches every artist's information into the caches (see precacheArtist). */
function scanArtists(token: string, userId: string, lastfmKey: string | undefined, scope: Scope = NO_SCOPE) {
  return runJob<Artist>(
    jobs.artists,
    async () => (await libraryItems<Artist>(token, userId, '/Artists', { userId, Fields: 'ProviderIds,Genres' }, scope.libraries)).filter((artist) => !leftOut(scope, [artist.Name], artist.Genres)),
    async (artist) => {
      const { found, failed } = await precacheArtist(artist, lastfmKey)
      if (failed.length) throw new Error(failed.join(' · '))
      return found
    },
    (artist) => ({ id: artist.Id, title: artist.Name ?? '' }),
  )
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  // Everything outside /api is the app.
  if (!url.pathname.startsWith('/api/') && url.pathname !== '/api') {
    // In front of Jellyfin: what is Jellyfin's goes through to it, the rest is the app.
    if (PROXY_JELLYFIN && isJellyfinRequest(request, url.pathname, await isAppFile(url.pathname))) return proxyToJellyfin(JELLYFIN_URL, request, response, url)
    return serveApp(request, response, url.pathname)
  }

  cors(request, response)
  if (request.method === 'OPTIONS') return send(response, 204)
  const path = url.pathname.slice(4).replace(/\/+$/, '') || '/'
  if (path === '/health') return send(response, 200, { ok: true })
  // What the sign-in page needs before anyone is signed in: the SSO providers, and whether Lumio fronts Jellyfin.
  if (path === '/public' && request.method === 'GET') {
    // Which outside services this server has keys for: the app asks them through it then (it needs no keys of its own).
    const services = Object.fromEntries((['lastfm', 'concerts', 'tmdb'] as const).map((name) => [name, !!RELAY_SERVICES[name]?.key?.value]))
    return send(response, 200, { sso: SSO_PROVIDERS, proxy: PROXY_JELLYFIN, services, passwordLogin: !DISABLE_PASSWORD_LOGIN })
  }
  // Pictures load from <img> tags, which carry no token; the host list keeps this to podcast covers.
  if (path === '/image' && request.method === 'GET') return serveImage(response, url.searchParams.get('url'))

  const me = await authenticate(tokenOf(request, url))
  if (!me) return send(response, 401, { error: 'Not signed in' })

  // GET /artist-profile/epidemic?name=…: an artist's description and photo from Epidemic Sound.
  if (path === '/artist-profile/epidemic' && request.method === 'GET') return serveEpidemicProfile(response, url.searchParams.get('name'))

  // POST /credits {ids}: the credits known for these tracks (left out: not looked up yet; null: none found).
  if (path === '/credits' && request.method === 'POST') {
    const { ids } = await readJson<{ ids?: unknown }>(request).catch(() => ({ ids: undefined }))
    if (!Array.isArray(ids) || ids.length > 300 || !ids.every((id) => typeof id === 'string' && /^[0-9a-f-]{32,36}$/i.test(id))) return send(response, 400, { error: 'Bad ids' })
    const known = store.trackCredits(ids as string[])
    return send(response, 200, Object.fromEntries(Object.entries(known).map(([id, entry]) => [id, entry.data])))
  }

  // POST /playlists/adds {playlistId, itemIds}: the user added these songs to a playlist (sent after Jellyfin took
  // them). GET /playlists/adds?playlistId=…: who added which song, for shared playlists.
  if (path === '/playlists/adds') {
    const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{32,36}$/i.test(value)
    if (request.method === 'POST') {
      const body = await readJson<{ playlistId?: unknown; itemIds?: unknown }>(request).catch(() => null)
      if (!isId(body?.playlistId) || !Array.isArray(body.itemIds) || body.itemIds.length > 400 || !body.itemIds.every(isId)) return send(response, 400, { error: 'Bad songs' })
      store.recordPlaylistAdds(body.playlistId, body.itemIds, me.id)
      return send(response, 204)
    }
    if (request.method === 'GET') {
      const playlistId = url.searchParams.get('playlistId')
      if (!isId(playlistId)) return send(response, 400, { error: 'Bad playlist' })
      return send(response, 200, store.playlistAdds(playlistId))
    }
  }

  // GET /credits/by-artist?name=…: the tracks someone is on (as an artist) or credited on (wrote, produced …), for
  // artists the library has no page for (guests the file tags leave out).
  if (path === '/credits/by-artist' && request.method === 'GET') {
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 200)
    if (!name) return send(response, 400, { error: 'Bad name' })
    const performed: string[] = []
    const credited: string[] = []
    for (const { id, data } of store.creditsMentioning(name)) {
      const credits = data as TrackCredits
      if (credits.artists?.some((entry) => sameName(entry, name))) performed.push(id)
      else if ([credits.writers, credits.composers, credits.lyricists, credits.producers, credits.mixers, credits.engineers].some((list) => list?.some((entry) => sameName(entry, name)))) {
        credited.push(id)
      }
    }
    return send(response, 200, { performed, credited })
  }

  // POST /credits/lookup {id, title, artist, album, seconds}: one track's credits, looked up now if they weren't.
  if (path === '/credits/lookup' && request.method === 'POST') {
    const body = await readJson<Partial<TrackMeta> & { id?: string }>(request).catch(() => null)
    if (!body || typeof body.id !== 'string' || !/^[0-9a-f-]{32,36}$/i.test(body.id) || typeof body.title !== 'string' || typeof body.artist !== 'string') {
      return send(response, 400, { error: 'Bad track' })
    }
    try {
      const credits = await creditsFor(body.id, {
        title: body.title.slice(0, 300),
        artist: body.artist.slice(0, 300),
        album: typeof body.album === 'string' ? body.album.slice(0, 300) : undefined,
        albumId: typeof body.albumId === 'string' && /^[0-9a-f-]{32,36}$/i.test(body.albumId) ? body.albumId : undefined,
        seconds: typeof body.seconds === 'number' ? body.seconds : undefined,
      })
      return send(response, 200, { credits })
    } catch {
      return send(response, 502, { error: 'MusicBrainz unavailable' })
    }
  }

  // /admin/jobs/<credits|artists>: an admin's task on the whole library (POST starts, DELETE stops, GET tells how far it
  // is): looking up every track's credits, or fetching every artist's information into the caches.
  const jobName = path.match(/^\/admin\/jobs\/(credits|artists)$/)?.[1] as JobName | undefined
  if (jobName) {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const job = jobs[jobName]
    if (request.method === 'POST' && !job.running) {
      const token = tokenOf(request, url)!
      // What to go through: an admin can leave libraries, artists and genres out (e.g. audio plays).
      type Body = { lastfmKey?: unknown; libraries?: unknown; excludeArtists?: unknown; excludeGenres?: unknown }
      const body = await readJson<Body>(request).catch(() => ({}) as Body)
      const texts = (value: unknown, pattern?: RegExp) =>
        Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && (!pattern || pattern.test(entry))).map((entry) => entry.slice(0, 200)).slice(0, 500) : []
      const scope: Scope = {
        libraries: Array.isArray(body.libraries) ? texts(body.libraries, /^[0-9a-f-]{32,36}$/i) : undefined,
        artists: texts(body.excludeArtists),
        genres: texts(body.excludeGenres),
      }
      if (jobName === 'credits') void scanCredits(token, me.id, scope)
      else void scanArtists(token, me.id, typeof body.lastfmKey === 'string' && /^[0-9a-f]{32}$/i.test(body.lastfmKey) ? body.lastfmKey : undefined, scope)
    }
    if (request.method === 'DELETE') job.stop = true
    const { stop: _stop, ...state } = job
    return send(response, 200, state)
  }

  // POST /admin/credits/search {title, artist}: recordings on MusicBrainz to pick from by hand.
  if (path === '/admin/credits/search' && request.method === 'POST') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const body = await readJson<{ title?: unknown; artist?: unknown }>(request).catch(() => null)
    const title = typeof body?.title === 'string' ? body.title.slice(0, 300).trim() : ''
    const artist = typeof body?.artist === 'string' ? body.artist.slice(0, 300).trim() : ''
    if (!title && !artist) return send(response, 400, { error: 'Nothing to search for' })
    try {
      return send(response, 200, await searchRecordings(title, artist, musicbrainz))
    } catch {
      return send(response, 502, { error: 'MusicBrainz unavailable' })
    }
  }

  // POST /admin/credits/fix {id, meta, recording?}: a track looked up again now, or given the recording an admin picked.
  if (path === '/admin/credits/fix' && request.method === 'POST') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const body = await readJson<{ id?: unknown; recording?: unknown; meta?: Partial<TrackMeta> }>(request).catch(() => null)
    const id = typeof body?.id === 'string' && /^[0-9a-f-]{32,36}$/i.test(body.id) ? body.id : null
    const meta = body?.meta
    if (!id || typeof meta?.title !== 'string' || typeof meta.artist !== 'string') return send(response, 400, { error: 'Bad track' })
    const clean: TrackMeta = {
      title: meta.title.slice(0, 300),
      artist: meta.artist.slice(0, 300),
      album: typeof meta.album === 'string' ? meta.album.slice(0, 300) : undefined,
      albumId: typeof meta.albumId === 'string' && /^[0-9a-f-]{32,36}$/i.test(meta.albumId) ? meta.albumId : undefined,
      seconds: typeof meta.seconds === 'number' ? meta.seconds : undefined,
    }
    const recording = typeof body?.recording === 'string' && /^[0-9a-f-]{36}$/i.test(body.recording) ? body.recording : null
    try {
      const credits = recording ? await creditsOfRecording(recording, clean.album, musicbrainz) : await lookupCredits(clean, musicbrainz)
      store.setTrackCredits(id, credits, { ...clean, ...(recording ? { picked: true } : {}) })
      jobs.credits.failures = jobs.credits.failures.filter((failure) => failure.id !== id)
      return send(response, 200, { credits })
    } catch {
      return send(response, 502, { error: 'MusicBrainz unavailable' })
    }
  }

  // POST /admin/artists/fix {id, name, musicBrainzId?, lastfmKey?}: one artist's information fetched again now.
  if (path === '/admin/artists/fix' && request.method === 'POST') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const body = await readJson<{ id?: unknown; name?: unknown; musicBrainzId?: unknown; lastfmKey?: unknown }>(request).catch(() => null)
    if (typeof body?.id !== 'string' || typeof body.name !== 'string' || !body.name.trim()) return send(response, 400, { error: 'Bad artist' })
    const artist: Artist = {
      Id: body.id,
      Name: body.name.slice(0, 300),
      ProviderIds: typeof body.musicBrainzId === 'string' && /^[0-9a-f-]{36}$/i.test(body.musicBrainzId) ? { MusicBrainzArtist: body.musicBrainzId } : {},
    }
    const result = await precacheArtist(artist, typeof body.lastfmKey === 'string' && /^[0-9a-f]{32}$/i.test(body.lastfmKey) ? body.lastfmKey : undefined)
    if (!result.failed.length) jobs.artists.failures = jobs.artists.failures.filter((failure) => failure.id !== body.id)
    return send(response, 200, result)
  }

  // GET /admin/credits?search=…&offset=…: the looked-up tracks, for browsing.
  if (path === '/admin/credits' && request.method === 'GET') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
    return send(response, 200, store.creditsPage((url.searchParams.get('search') ?? '').slice(0, 200).trim(), offset, 50))
  }

  // POST /admin/credits/edit {id, meta, credits}: credits an admin wrote by hand (kept; no lookup replaces them).
  if (path === '/admin/credits/edit' && request.method === 'POST') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const body = await readJson<{ id?: unknown; meta?: Record<string, unknown>; credits?: Record<string, unknown> }>(request).catch(() => null)
    const id = typeof body?.id === 'string' && /^[0-9a-f-]{32,36}$/i.test(body.id) ? body.id : null
    if (!id || !body?.credits || typeof body.credits !== 'object') return send(response, 400, { error: 'Bad credits' })
    const names = (value: unknown) =>
      Array.isArray(value) ? [...new Set(value.filter((name): name is string => typeof name === 'string').map((name) => name.trim().slice(0, 200)).filter(Boolean))].slice(0, 50) : []
    const given = body.credits
    const credits: TrackCredits = {
      recording: typeof given.recording === 'string' ? given.recording.slice(0, 36) : '',
      artists: names(given.artists),
      writers: names(given.writers),
      composers: names(given.composers),
      lyricists: names(given.lyricists),
      producers: names(given.producers),
      mixers: names(given.mixers),
      engineers: names(given.engineers),
      publishers: names(given.publishers),
      labels: names(given.labels),
      isrc: typeof given.isrc === 'string' && given.isrc.trim() ? given.isrc.trim().slice(0, 15) : undefined,
    }
    const meta = body.meta ?? {}
    const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 300) : undefined)
    store.setTrackCredits(id, credits, { title: text(meta.title), artist: text(meta.artist), album: text(meta.album), albumId: text(meta.albumId), edited: true })
    jobs.credits.failures = jobs.credits.failures.filter((failure) => failure.id !== id)
    return send(response, 200, { credits })
  }

  // GET /admin/credits-missing: the tracks MusicBrainz had nothing for.
  if (path === '/admin/credits-missing' && request.method === 'GET') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    return send(response, 200, store.tracksWithoutCredits())
  }

  // GET /podcast-audio?url=…: a podcast episode's audio, passed through for downloading it.
  if (path === '/podcast-audio' && request.method === 'GET') return servePodcastAudio(request, response, url.searchParams.get('url'))

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

  // POST /me/plays {session, key, title, subtitle, contextId, image, client, startedAt, seconds}: how long the user has
  // been listening to a podcast episode in this session (sent while it plays; Jellyfin never sees podcasts).
  // GET /me/plays?limit=&before=: their plays, newest first.
  if (path === '/me/plays') {
    if (request.method === 'POST') {
      const body = await readJson<Record<string, unknown>>(request).catch(() => null)
      const text = (value: unknown, max = 300) => (typeof value === 'string' && value.trim() ? value.slice(0, max) : undefined)
      const session = text(body?.session, 64)
      const key = text(body?.key, 500)
      const title = text(body?.title)
      const startedAt = Number(body?.startedAt)
      const seconds = Math.round(Number(body?.seconds))
      if (!session || !key || !title || !Number.isFinite(startedAt) || !Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) return send(response, 400, { error: 'Bad play' })
      store.recordPlay({
        session,
        userId: me.id,
        kind: 'podcast',
        key,
        title,
        subtitle: text(body?.subtitle),
        contextId: text(body?.contextId, 100),
        image: text(body?.image, 1000),
        client: text(body?.client, 100),
        startedAt: Math.min(startedAt, Date.now()),
        seconds,
      })
      return send(response, 204)
    }
    if (request.method === 'GET') {
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
      const before = Number(url.searchParams.get('before')) || undefined
      return send(response, 200, store.plays(me.id, limit, before))
    }
  }

  // GET /admin/plays?from=&to=: everyone's plays in a time span (ms), with who played them.
  if (path === '/admin/plays' && request.method === 'GET') {
    if (!isAdmin(tokenOf(request, url))) return send(response, 403, { error: 'Administrators only' })
    const to = Number(url.searchParams.get('to')) || Date.now()
    const from = Number(url.searchParams.get('from')) || to - 30 * 24 * HOUR
    const plays = store.playsBetween(from, to)
    const people = Object.fromEntries(store.people([...new Set(plays.map((play) => play.userId))]).map((person) => [person.id, person.name]))
    return send(response, 200, plays.map((play) => ({ ...play, userName: people[play.userId] ?? '' })))
  }

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

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(error)
    if (!response.headersSent) send(response, 500, { error: 'Server error' })
    else response.end()
  })
})
// Jellyfin's WebSockets (live updates, remote control) go through too when Lumio fronts it.
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  if (PROXY_JELLYFIN && !pathname.startsWith('/api/')) proxyUpgrade(JELLYFIN_URL, request, socket as Socket, head)
  else socket.destroy()
})
server.listen(PORT, () => console.log(`Lumio on :${PORT} (app from ${WEB_DIR}), Jellyfin at ${JELLYFIN_URL}${PROXY_JELLYFIN ? ' (proxied)' : ''}`))
