/*
 * Lumio's service worker: keeps everything you see in the browser, so the app opens at once and works without a
 * connection. Songs and episodes have caches of their own (managed by the app); this handles the rest.
 * - The app's built files under /assets/ carry a hash in their name and never change: from the cache, fetched once.
 * - The page (every in-app address is the same index.html): from the network, so a new version is there at once;
 *   the kept copy only when the network is away or too slow (offline start).
 * - Pictures (covers, photos, posters, from Jellyfin and elsewhere): from the cache once seen. Jellyfin's image URLs
 *   carry a tag that changes with the image, so those never need checking; others are refreshed in the background.
 *   They are fetched as CORS requests so the stored copy is a real one (an opaque copy would cost browsers megabytes
 *   of quota each); hosts that don't allow that just load normally.
 * The app can clear these caches (the user in the settings, or an admin for every device).
 */
// v2: drops copies of the page kept by the stale-first strategy of v1.
const SHELL = 'lumio-shell-v2'
const IMAGES = 'lumio-images-v1'
/** Pictures kept at most; the oldest go first. */
const MAX_IMAGES = 4000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Older versions of these caches go; the song and episode caches are the app's business.
      for (const name of await caches.keys()) {
        if ((name.startsWith('lumio-shell-') && name !== SHELL) || (name.startsWith('lumio-images-') && name !== IMAGES)) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') event.respondWith(networkFirst(SHELL, new Request('/index.html'), request))
    else if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(SHELL, request, request))
    else if (/\.(svg|png|ico|webmanifest|woff2?)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(SHELL, request, request))
    // Pictures relayed by the Lumio server (podcast covers): their address never changes.
    else if (url.pathname === '/api/image') event.respondWith(cacheFirst(IMAGES, request, request))
    return
  }

  if (request.destination === 'image' && url.protocol === 'https:') {
    // Fetched as CORS; without credentials, as images need none.
    const cors = new Request(request.url, { mode: 'cors', credentials: 'omit' })
    event.respondWith(url.searchParams.has('tag') ? cacheFirst(IMAGES, request, cors) : staleWhileRevalidate(IMAGES, request, cors))
  }
})

let imagesSinceTrim = 0

async function store(cacheName, key, response) {
  // Only real (CORS or same-origin) copies are kept, never opaque ones.
  if (!response.ok || response.type === 'opaque') return
  const cache = await caches.open(cacheName)
  await cache.put(key, response)
  if (cacheName === IMAGES && ++imagesSinceTrim >= 100) {
    imagesSinceTrim = 0
    const keys = await cache.keys()
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(old)
  }
}

/** Fetches the CORS version, falling back to the browser's own request when the host doesn't allow CORS. */
async function load(request, original) {
  try {
    return await fetch(request)
  } catch {
    return fetch(original)
  }
}

async function cacheFirst(cacheName, key, request) {
  const hit = await caches.match(key, { cacheName })
  if (hit) return hit
  const response = await load(request, key)
  void store(cacheName, key, response.clone())
  return response
}

/** How long the page may take before the kept copy is shown instead. */
const PAGE_TIMEOUT_MS = 3000

/** A fresh copy (kept for later); the kept one when the network fails or takes too long. */
async function networkFirst(cacheName, key, request) {
  const fresh = fetch(request).then((response) => {
    if (response.ok) void store(cacheName, key, response.clone())
    return response
  })
  const late = new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS))
  try {
    const first = await Promise.race([fresh, late])
    if (first) return first
  } catch {
    // Offline: the kept copy below.
  }
  const hit = await caches.match(key, { cacheName })
  if (hit) return hit
  return fresh.catch(() => new Response('Offline', { status: 503, statusText: 'Offline' }))
}

/** The cached copy at once (if any), while a fresh one is fetched for next time. */
async function staleWhileRevalidate(cacheName, key, request) {
  const hit = await caches.match(key, { cacheName })
  const fresh = load(request, key)
    .then((response) => {
      void store(cacheName, key, response.clone())
      return response
    })
    .catch(() => undefined)
  if (hit) return hit
  return (await fresh) ?? new Response('Offline', { status: 503, statusText: 'Offline' })
}
