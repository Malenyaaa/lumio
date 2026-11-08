import { useSyncExternalStore } from 'react'

/**
 * Whether Lumio is offline: the browser says so, or the media server can't be reached. Songs and videos that need the
 * network are greyed out and skipped meanwhile.
 *
 * The browser's own signal isn't enough: "online" only means a network is there, and some browsers (Firefox's offline
 * mode in its developer tools, for one) don't report the change at all. So a small ping to the server decides: every
 * 30 seconds while online, every 5 while offline (so coming back shows quickly), and at once when the browser reports a
 * change, the tab comes back to the front or a request failed without an answer. Any answer of the server means it is
 * reachable; requests that get through say so too.
 */
let browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine
let serverReachable = true
const listeners = new Set<() => void>()

/** The server's ping address (set while signed in), and the next scheduled check. */
let pingUrl: string | null = null
let timer: number | undefined
let probing = false

const ONLINE_CHECK_MS = 30_000
const OFFLINE_CHECK_MS = 5_000
const PING_TIMEOUT_MS = 8_000

function emit() {
  for (const listener of listeners) listener()
}

function set(next: { browser?: boolean; server?: boolean }) {
  const before = isOffline()
  if (next.browser !== undefined) browserOnline = next.browser
  if (next.server !== undefined) serverReachable = next.server
  if (isOffline() !== before) emit()
}

function schedule(delay = isOffline() ? OFFLINE_CHECK_MS : ONLINE_CHECK_MS) {
  if (typeof window === 'undefined') return
  window.clearTimeout(timer)
  if (pingUrl) timer = window.setTimeout(() => void probe(), delay)
}

/** Asks the server whether it is there; its answer (any answer) decides, whatever the browser thinks. */
async function probe() {
  if (!pingUrl || probing) return
  probing = true
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const response = await fetch(pingUrl, { cache: 'no-store', signal: controller.signal })
    // A server error (a proxy without its upstream) isn't the server.
    set(response.status >= 500 ? { server: false } : { browser: true, server: true })
  } catch {
    set({ server: false })
  } finally {
    window.clearTimeout(timeout)
    probing = false
    schedule()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    set({ browser: true })
    void probe()
  })
  window.addEventListener('offline', () => {
    set({ browser: false })
    schedule()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probe()
  })
  window.addEventListener('focus', () => void probe())
}

/** Set while signed in: where the server answers its ping (null signed out). Checks right away. */
export function setReachabilityProbe(url: string | null) {
  pingUrl = url
  if (url) void probe()
  else window.clearTimeout(timer)
}

/** Checks now (a request failed without an answer, the live connection dropped). */
export function checkReachability() {
  void probe()
}

/** Told by the requests to the media server: one got an answer (true), or failed without one (false). */
export function markServerReachable(reachable: boolean) {
  if (reachable) set({ server: true })
  else {
    set({ server: false })
    schedule(OFFLINE_CHECK_MS)
  }
}

export const isOffline = () => !browserOnline || !serverReachable

export function useOffline() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isOffline,
  )
}
