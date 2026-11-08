import { queryClient } from './query-client'
import { clearPersistedQueries, persistedQueryBytes } from './query-persist'

/**
 * Clearing what Lumio keeps for quick, offline starts: its own files and the pictures (the service worker's caches)
 * and the library data kept between visits. Songs and episodes have their own caches and buttons. A user clears it in
 * the settings; an admin can make every device clear it once (a version number in the server-wide config).
 */
const SHELL_CACHE = 'lumio-shell-v1'
const IMAGE_CACHE = 'lumio-images-v1'
const VERSION_KEY = 'lumio.cacheVersion'

export async function clearAppCaches() {
  await clearPersistedQueries()
  if ('caches' in window) await Promise.all([caches.delete(SHELL_CACHE), caches.delete(IMAGE_CACHE)]).catch(() => undefined)
  // What is on screen is loaded again from the server.
  void queryClient.invalidateQueries()
}

/** Clears once when the admin's cache version differs from the one this device last saw. */
export function applyCacheVersion(version: number | undefined) {
  if (!version) return
  let seen = 0
  try {
    seen = Number(localStorage.getItem(VERSION_KEY) ?? 0)
    localStorage.setItem(VERSION_KEY, String(version))
  } catch {
    return
  }
  if (seen !== version) void clearAppCaches()
}

/** Size of the app's own caches (files, pictures and the kept library data), counted from what they hold. */
export async function appCacheBytes() {
  let total = await persistedQueryBytes()
  if (!('caches' in window)) return total
  for (const name of [SHELL_CACHE, IMAGE_CACHE]) {
    if (!(await caches.has(name))) continue
    const cache = await caches.open(name)
    for (const request of await cache.keys()) {
      const response = await cache.match(request)
      const length = Number(response?.headers.get('Content-Length'))
      total += Number.isFinite(length) && length > 0 ? length : ((await response?.blob())?.size ?? 0)
    }
  }
  return total
}
