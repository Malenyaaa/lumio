import { useSyncExternalStore } from 'react'

/**
 * Whether Lumio is offline: the browser says so, or the media server can't be reached (requests to it fail without an
 * answer). Requests that get through say it is back. Songs that need the network are greyed out and skipped meanwhile.
 */
let browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine
let serverReachable = true
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    browserOnline = true
    emit()
  })
  window.addEventListener('offline', () => {
    browserOnline = false
    emit()
  })
}

/** Told by the requests to the media server: one got an answer (true), or failed without one (false). */
export function markServerReachable(reachable: boolean) {
  if (serverReachable === reachable) return
  serverReachable = reachable
  emit()
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
