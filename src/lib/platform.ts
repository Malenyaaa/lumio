/**
 * Where this copy of Lumio runs. On the web the Lumio server serves the pages, so its API is this address's /api. The
 * apps (Android via Capacitor, built with VITE_BUNDLED) carry the pages themselves: there the server is the one the
 * user signed in to (its address in the session; Lumio fronts Jellyfin there, PROXY_JELLYFIN).
 */
export const BUNDLED = !!import.meta.env.VITE_BUNDLED

/** The Lumio server's address: '' (this one) on the web, the signed-in server in an app ('' before signing in). */
export function lumioServer(): string {
  if (!BUNDLED) return ''
  try {
    const session = JSON.parse(localStorage.getItem('lumio.session') ?? 'null') as { serverUrl?: string } | null
    return (session?.serverUrl ?? '').replace(/\/+$/, '')
  } catch {
    return ''
  }
}

/** The Lumio server's API; VITE_SOCIAL_URL overrides it for setups that serve the app from elsewhere. */
export function apiBase(): string {
  return (import.meta.env.VITE_SOCIAL_URL?.trim() || `${lumioServer()}/api`).replace(/\/+$/, '')
}
