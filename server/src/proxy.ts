import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { connect as netConnect, type Socket } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

/**
 * Lumio in front of Jellyfin (PROXY_JELLYFIN=true): Lumio is the only public face, and everything that belongs to
 * Jellyfin is passed through to it, so one address serves both:
 * - the API, in full (Lumio itself, and every Jellyfin app: Android, iOS, TVs, Infuse …), streams with ranges and the
 *   WebSockets included;
 * - jellyfin-web under /web/, for the administration only (dashboard, metadata editor, plugin pages): a small script
 *   put into its page sends everything else back to Lumio, hands Lumio's sign-in over to it, and lets Lumio take over a
 *   sign-in made there (the SSO plugin finishes its sign-ins in jellyfin-web);
 * - the SSO plugin's own pages (/sso/…).
 * What is Lumio's: /api, the app's files and its pages (lowercase paths opened as pages). Jellyfin's endpoints are
 * PascalCase and fetched as data, so the two don't collide.
 */

/** Lumio's own top-level pages (see App.tsx); opened as a page, they are the app. */
const APP_ROUTES = new Set(['', 'login', 'listen', 'movie', 'show', 'album', 'artist', 'item', 'browse', 'library', 'watchlist', 'history', 'search', 'person', 'settings', 'plugin', 'play', 'index.html'])
/** Jellyfin's lowercase paths (WebSockets, the SSO plugin, jellyfin-web). */
const JELLYFIN_LOWER = new Set(['web', 'socket', 'embywebsocket', 'sso', 'emby', 'mediabrowser', 'jellyfin'])

/** Whether a request (outside /api) is Jellyfin's rather than the app's. `isAppFile` tells whether the app has a file there. */
export function isJellyfinRequest(request: IncomingMessage, pathname: string, isAppFile: boolean) {
  const first = pathname.split('/')[1] ?? ''
  if (JELLYFIN_LOWER.has(first.toLowerCase())) return true
  if (request.method !== 'GET' && request.method !== 'HEAD') return true
  if (/^[A-Z]/.test(first)) return true
  if (isAppFile) return false
  const page = (request.headers.accept ?? '').includes('text/html')
  // Lowercase and opened as a page: the app (it shows "not found" itself); fetched as data: Jellyfin.
  return !(page || APP_ROUTES.has(first))
}

function upstreamOf(base: string) {
  const url = new URL(base)
  const secure = url.protocol === 'https:'
  return { url, secure, port: Number(url.port) || (secure ? 443 : 80), prefix: url.pathname.replace(/\/+$/, '') }
}

/**
 * The headers sent on: the caller's, with where the request really came from (Jellyfin trusts them from known proxies).
 * A Jellyfin reached over https (elsewhere, behind its own proxy) is asked for by its own name; one in the same stack
 * (plain http) keeps the public name, so the addresses it builds are the public ones.
 */
function forwardedHeaders(request: IncomingMessage, upstream?: ReturnType<typeof upstreamOf>) {
  const headers = { ...request.headers }
  if (upstream?.secure) headers.host = upstream.url.host
  const client = request.socket.remoteAddress ?? ''
  headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${client}` : client
  headers['x-forwarded-proto'] ??= 'encrypted' in request.socket && request.socket.encrypted ? 'https' : 'http'
  headers['x-forwarded-host'] ??= headers.host
  return headers
}

/** Passes an HTTP request through to Jellyfin and its answer back, streamed (videos, songs, downloads). */
export function proxyToJellyfin(base: string, request: IncomingMessage, response: ServerResponse, url: URL) {
  const upstream = upstreamOf(base)
  const headers = forwardedHeaders(request, upstream)
  // jellyfin-web's page gets the admin script: asked for uncompressed, so it can be put in, and always in full (a copy
  // the browser kept from before Lumio fronted Jellyfin has no script, and a "not modified" would keep it).
  const isWebPage = (request.method === 'GET' || request.method === 'HEAD') && /^\/web\/?(index\.html)?$/i.test(url.pathname)
  if (isWebPage) {
    headers['accept-encoding'] = 'identity'
    delete headers['if-none-match']
    delete headers['if-modified-since']
  }
  const outgoing = (upstream.secure ? httpsRequest : httpRequest)(
    {
      hostname: upstream.url.hostname,
      port: upstream.port,
      method: request.method,
      path: upstream.prefix + url.pathname + url.search,
      headers,
      ...(upstream.secure ? { servername: upstream.url.hostname } : {}),
    },
    (answer) => {
      const type = String(answer.headers['content-type'] ?? '')
      if (isWebPage && request.method === 'GET' && answer.statusCode === 200 && type.includes('text/html')) {
        const chunks: Buffer[] = []
        answer.on('data', (chunk: Buffer) => chunks.push(chunk))
        answer.on('end', () => {
          const page = Buffer.concat(chunks).toString('utf8').replace(/<head([^>]*)>/i, (tag) => `${tag}<script>${ADMIN_SCRIPT}</script>`)
          const { 'content-length': _length, 'content-encoding': _encoding, etag: _etag, 'last-modified': _modified, ...rest } = answer.headers
          response.writeHead(200, { ...rest, 'Content-Length': Buffer.byteLength(page), 'Cache-Control': 'no-store' })
          response.end(page)
        })
        return
      }
      response.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.pipe(response)
    },
  )
  outgoing.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Jellyfin unavailable' }))
    } else response.destroy()
  })
  // The caller hung up (a skipped video): stop fetching it.
  response.on('close', () => outgoing.destroy())
  request.pipe(outgoing)
}

/** Passes a WebSocket (Jellyfin's live updates and remote control) through to Jellyfin. */
export function proxyUpgrade(base: string, request: IncomingMessage, socket: Socket, head: Buffer) {
  const upstream = upstreamOf(base)
  const target = upstream.secure
    ? tlsConnect({ host: upstream.url.hostname, port: upstream.port, servername: upstream.url.hostname })
    : netConnect({ host: upstream.url.hostname, port: upstream.port })
  const ready = upstream.secure ? 'secureConnect' : 'connect'
  target.once(ready, () => {
    const headers = forwardedHeaders(request, upstream)
    const lines = [`${request.method} ${upstream.prefix}${request.url} HTTP/1.1`]
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue
      for (const entry of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${entry}`)
    }
    target.write(lines.join('\r\n') + '\r\n\r\n')
    if (head.length) target.write(head)
    socket.pipe(target).pipe(socket)
  })
  const close = () => {
    socket.destroy()
    target.destroy()
  }
  target.on('error', close)
  socket.on('error', close)
  target.on('close', close)
  socket.on('close', close)
}

/**
 * Put into jellyfin-web's page, before its own scripts. jellyfin-web stays for the administration only:
 * - the dashboard (and its subpages), the metadata editor and plugin configuration pages are allowed;
 * - everything else (its home, its player, leaving the dashboard) goes back to Lumio;
 * - someone signed in to Lumio but not here is signed in with Lumio's session (no second sign-in);
 * - a sign-in made here (the SSO plugin finishes in jellyfin-web) is taken over by Lumio;
 * - signed in nowhere, the admin pages first send to Lumio's sign-in, and come back after;
 * - inside a frame (the SSO plugin's sign-in page loads jellyfin-web hidden, to set up its storage) it does nothing.
 */
export const ADMIN_SCRIPT = `(function () {
  var ADMIN = /^#!?\\/(dashboard|metadata|configurationpage|edititemmetadata|dashboardgeneral|scheduledtasks|plugins|devices|users|useredit|userprofiles|networking|apikeys|log|notificationsettings|encodingsettings|librarysettings|library|livetvsettings|livetvstatus|playbackconfiguration|streamingsettings|serveractivity)(?:[/.?]|$)/i;
  // Where jellyfin-web's own pages lead in Lumio (leaving the dashboard lands on one of these).
  var LUMIO = [
    [/^#!?\\/(home|movies|tv|livetv|list|favorites|home\\.html)?(?:[/?.]|$)/i, '/'],
    [/^#!?\\/music(?:[/?.]|$)/i, '/listen'],
    [/^#!?\\/userprofile(?:[/?.]|$)/i, '/settings/profile'],
    [/^#!?\\/mypreferencesmenu(?:[/?.]|$)/i, '/settings'],
    [/^#!?\\/mypreferencesdisplay(?:[/?.]|$)/i, '/settings/interface'],
    [/^#!?\\/mypreferenceshome(?:[/?.]|$)/i, '/settings/home'],
    [/^#!?\\/mypreferencesplayback(?:[/?.]|$)/i, '/settings/playback'],
    [/^#!?\\/mypreferencessubtitles(?:[/?.]|$)/i, '/settings/subtitles'],
    [/^#!?\\/mypreferencescontrols(?:[/?.]|$)/i, '/settings/controls'],
    [/^#!?\\/quickconnect(?:[/?.]|$)/i, '/?connect=1'],
    [/^#!?\\/search(?:[/?.]|$)/i, '/search']
  ];
  function lumioPath(hash) {
    var details = hash.match(/^#!?\\/details\\?(.*)$/i);
    if (details) { var id = new URLSearchParams(details[1]).get('id'); if (id) return '/item/' + encodeURIComponent(id); }
    for (var i = 0; i < LUMIO.length; i++) if (LUMIO[i][0].test(hash)) return LUMIO[i][1];
    return '/';
  }
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }
  function jellyfinSession() { var c = read('jellyfin_credentials'); var s = c && c.Servers && c.Servers[0]; return s && s.AccessToken ? s : null; }
  function handOver(lumio) {
    var info = {};
    try { var x = new XMLHttpRequest(); x.open('GET', '/System/Info/Public', false); x.send(); info = JSON.parse(x.responseText); } catch (e) {}
    localStorage.setItem('jellyfin_credentials', JSON.stringify({ Servers: [{
      Id: info.Id, Name: info.ServerName, ManualAddress: location.origin, LocalAddress: location.origin,
      AccessToken: lumio.accessToken, UserId: lumio.userId, DateLastAccessed: Date.now(), LastConnectionMode: 2, ManualAddressOnly: true
    }] }));
  }
  function check() {
    // Inside a frame jellyfin-web is someone's helper, not a page to leave: the SSO plugin loads it in a hidden frame to
    // set up its storage before finishing a sign-in.
    if (window.top !== window.self) return;
    var hash = location.hash || '';
    var lumio = read('lumio.session');
    if (ADMIN.test(hash)) {
      if (lumio && (!jellyfinSession() || jellyfinSession().UserId !== lumio.userId)) handOver(lumio);
      else if (!lumio && !jellyfinSession()) location.replace('/login?next=' + encodeURIComponent('/web/' + hash));
      return;
    }
    // Anything else is Lumio's, at its counterpart there. A fresh sign-in made here (SSO) is taken over first.
    var target = lumioPath(hash);
    location.replace(jellyfinSession() && !lumio ? '/login?adopt=1&next=' + encodeURIComponent(target) : target);
  }
  check();
  window.addEventListener('hashchange', check);
})();`
