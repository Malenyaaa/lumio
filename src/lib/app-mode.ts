import { useLocation } from 'react-router'

/**
 * Lumio is two apps from one hand: Watch (films, series, anime) and Listen (music, audiobooks, podcasts). They share
 * the account, the settings and the brand, but each has its own layout tuned to its medium. Listen lives under
 * /listen; everything else is Watch.
 */
export type AppMode = 'watch' | 'listen'

export const APP_MODES: AppMode[] = ['watch', 'listen']

export const modeOf = (pathname: string): AppMode => (pathname === '/listen' || pathname.startsWith('/listen/') ? 'listen' : 'watch')

/** Where each app starts. */
export const modeHome = (mode: AppMode) => (mode === 'listen' ? '/listen' : '/')

/** A path inside the given app: Watch uses paths as they are, Listen prefixes them (`/settings` → `/listen/settings`). */
export const inMode = (mode: AppMode, path: string) => (mode === 'listen' ? `/listen${path === '/' ? '' : path}` : path)

export function useAppMode(): AppMode {
  return modeOf(useLocation().pathname)
}

const LAST_MODE_KEY = 'lumio.mode'

/**
 * Whether this is the start page of a fresh visit to Lumio's root: the only moment Lumio opens the app used last
 * instead of Watch. Later visits to / (Watch's start page, chosen on purpose) stay where they are.
 */
export function isLaunchAtRoot(pathname: string) {
  const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
  return pathname === '/' && index === 0
}

/** The app used last on this device; Lumio opens in it. */
export function lastMode(): AppMode {
  try {
    return localStorage.getItem(LAST_MODE_KEY) === 'listen' ? 'listen' : 'watch'
  } catch {
    return 'watch'
  }
}

export function rememberMode(mode: AppMode) {
  try {
    localStorage.setItem(LAST_MODE_KEY, mode)
  } catch {
    // Not remembered; the next start opens Watch.
  }
}

/** Where each app was left, so switching back returns there instead of to its start page. */
const lastPath = new Map<AppMode, string>()

export function rememberPath(mode: AppMode, path: string) {
  lastPath.set(mode, path)
}

export const resumePath = (mode: AppMode) => lastPath.get(mode) ?? modeHome(mode)
