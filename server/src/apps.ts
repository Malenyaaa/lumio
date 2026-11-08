/**
 * Lumio's apps (Android, Windows, Linux) as the newest GitHub Release has them: listed for the app's download dialog
 * and update checks, and downloaded through this server (it sends the browser on to the file, so the newest is always
 * what comes). APP_RELEASES_REPO (owner/name) points elsewhere for forks.
 */
const REPO = process.env.APP_RELEASES_REPO?.trim() || 'PalmarHealer/lumio'
/** GitHub allows 60 unauthenticated requests an hour: the list is kept a while. */
const CACHE_MS = 10 * 60_000

export type AppKind = 'android' | 'windows' | 'appimage' | 'deb'

/** Which file of a release is which app. */
const KINDS: Array<[AppKind, RegExp]> = [
  ['android', /\.apk$/i],
  ['windows', /-setup\.exe$/i],
  ['appimage', /\.AppImage$/i],
  ['deb', /\.deb$/i],
]

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

let cached: { at: number; release: AppRelease | null } | null = null

export async function latestApps(): Promise<AppRelease | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.release
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lumio' },
    })
    if (!response.ok) throw new Error(`GitHub ${response.status}`)
    const data = (await response.json()) as { tag_name?: string; html_url?: string; assets?: Array<{ name: string; size: number; browser_download_url: string }> }
    const assets: AppAsset[] = []
    for (const asset of data.assets ?? []) {
      const kind = KINDS.find(([, pattern]) => pattern.test(asset.name))?.[0]
      if (kind) assets.push({ kind, name: asset.name, size: asset.size, url: asset.browser_download_url })
    }
    const release = { version: (data.tag_name ?? '').replace(/^v/, ''), page: data.html_url ?? `https://github.com/${REPO}/releases/latest`, assets }
    cached = { at: Date.now(), release }
    return release
  } catch {
    // GitHub unreachable: what was known (even if old), else nothing.
    return cached?.release ?? null
  }
}
