import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { apiBase, devicePlatform, type AppPlatform } from '@/lib/platform'

/**
 * Lumio's apps from the newest GitHub Release, as the Lumio server lists them (server/src/apps.ts); downloads go
 * through the server too (`appDownloadUrl`), so they always give the newest.
 */
export type AppKind = 'android' | 'windows' | 'appimage' | 'deb'

export interface AppAsset {
  kind: AppKind
  name: string
  size: number
  url: string
}

export interface AppRelease {
  version: string
  page: string
  assets: AppAsset[]
}

const GITHUB_LATEST = 'https://api.github.com/repos/PalmarHealer/lumio/releases/latest'
const KINDS: Array<[AppKind, RegExp]> = [
  ['android', /\.apk$/i],
  ['windows', /-setup\.exe$/i],
  ['appimage', /\.AppImage$/i],
  ['deb', /\.deb$/i],
]

/** The newest release: from the Lumio server, else straight from GitHub (an older server without the list). */
export async function fetchLatestApps(): Promise<AppRelease | null> {
  const fromServer = await fetch(`${apiBase()}/apps`)
    .then((response) => (response.ok ? (response.json() as Promise<AppRelease>) : null))
    .catch(() => null)
  if (fromServer) return fromServer
  const data = await fetch(GITHUB_LATEST, { headers: { Accept: 'application/vnd.github+json' } })
    .then((response) => (response.ok ? (response.json() as Promise<{ tag_name?: string; html_url?: string; assets?: Array<{ name: string; size: number; browser_download_url: string }> }>) : null))
    .catch(() => null)
  if (!data?.tag_name) return null
  const assets = (data.assets ?? []).flatMap((asset) => {
    const kind = KINDS.find(([, pattern]) => pattern.test(asset.name))?.[0]
    return kind ? [{ kind, name: asset.name, size: asset.size, url: asset.browser_download_url }] : []
  })
  return { version: data.tag_name.replace(/^v/, ''), page: data.html_url ?? '', assets }
}

export function useLatestApps(enabled = true) {
  return useQuery({ queryKey: ['lumio-apps'], queryFn: fetchLatestApps, enabled, staleTime: 10 * 60_000, retry: false })
}

/** The file through the Lumio server (it sends on to the newest release's). */
export const appDownloadUrl = (kind: AppKind) => `${apiBase()}/apps/download/${kind}`

/** The app that fits this device (Linux: the AppImage, which runs everywhere). */
export function defaultAppKind(platform: AppPlatform | null = devicePlatform()): AppKind {
  return platform === 'android' ? 'android' : platform === 'linux' ? 'appimage' : 'windows'
}

/** Whether `a` (1.2.3) is newer than `b`. */
export function isNewer(a: string, b: string) {
  const parts = (version: string) => version.replace(/^v/, '').split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

// ---- the download dialog, opened from the profile menu and the app hint ----

let dialogOpen = false
const listeners = new Set<() => void>()

export function setAppDownloadOpen(open: boolean) {
  dialogOpen = open
  for (const listener of listeners) listener()
}

export function useAppDownloadOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => dialogOpen,
  )
}
