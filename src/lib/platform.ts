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

/** Where Lumio's apps (Android, Windows, Linux) are downloaded: the newest GitHub Release. */
export const APP_DOWNLOAD_URL = 'https://github.com/PalmarHealer/lumio/releases/latest'

/** Lumio's apps by system: Android (APK), Windows (installer), Linux (AppImage, deb). */
export type AppPlatform = 'android' | 'windows' | 'linux'

/** Which of the apps fits this device; null where there is none (iPhone, iPad, Mac, ChromeOS). */
export function devicePlatform(): AppPlatform | null {
  if (typeof navigator === 'undefined') return null
  const agent = navigator.userAgent
  if (/Android/i.test(agent)) return 'android'
  if (/Windows/i.test(agent)) return 'windows'
  if (/Linux/i.test(agent) && !/CrOS/i.test(agent)) return 'linux'
  return null
}
