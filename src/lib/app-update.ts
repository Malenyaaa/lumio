import { App as CapacitorApp } from '@capacitor/app'
import { registerPlugin } from '@capacitor/core'
import { useSyncExternalStore } from 'react'
import { fetchLatestApps, isNewer } from '@/lib/apps'
import { inCapacitor } from '@/lib/capacitor'
import { desktop, type UpdateCheck } from '@/lib/desktop'

/**
 * Lumio's apps updating themselves: looking for a newer release, the downloaded update, installing it. The card
 * (components/update-ready) and Settings → App show it.
 */
interface UpdaterPlugin {
  download(options: { url: string }): Promise<{ path: string }>
  install(): Promise<void>
}

const Updater = registerPlugin<UpdaterPlugin>('LumioUpdater')

/** Android checks at most this often (the desktop app checks in its main process at every start). */
const CHECK_EVERY_MS = 6 * 60 * 60_000
const CHECKED_KEY = 'lumio.updateCheckedAt'

/** A new version that is downloaded and waits to be installed (Lumio's own apps). */
interface Ready {
  version: string
  kind: 'android' | 'desktop' | 'deb'
}

// The downloaded update, shared by the card and Settings → App (which can look for one by hand).
let ready: Ready | null = null
const listeners = new Set<() => void>()

export function setReadyUpdate(next: Ready) {
  ready = next
  for (const listener of listeners) listener()
}

export function useReadyUpdate() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => ready,
  )
}

/** The version of the app Lumio runs in (Android, desktop); null in a browser or an older app. */
export async function appVersion(): Promise<string | null> {
  if (inCapacitor()) return (await CapacitorApp.getInfo()).version
  return (await desktop()?.getVersion?.()) ?? null
}

/**
 * Looks for a newer release and downloads it. `force` (the button in the settings) checks whatever the automatic
 * setting and the last check say. Android: the APK; desktop: the main process does it.
 */
export async function checkForUpdate(force = false): Promise<UpdateCheck> {
  const app = desktop()
  if (app) {
    if (!app.checkUpdate) return 'failed'
    const result = await app.checkUpdate().catch(() => 'failed' as const)
    if (result === 'ready') await app.getUpdate().then((update) => update && setReadyUpdate(update))
    return result
  }
  if (!inCapacitor()) return 'off'
  if (ready) return 'ready'
  try {
    if (!force) {
      const last = Number(localStorage.getItem(CHECKED_KEY) ?? 0)
      if (Date.now() - last < CHECK_EVERY_MS) return 'current'
    }
    localStorage.setItem(CHECKED_KEY, String(Date.now()))
    const [info, release] = await Promise.all([CapacitorApp.getInfo(), fetchLatestApps()])
    if (!release) return 'failed'
    const apk = release.assets.find((asset) => asset.kind === 'android')
    if (!apk || !isNewer(release.version, info.version)) return 'current'
    await Updater.download({ url: apk.url })
    setReadyUpdate({ version: release.version, kind: 'android' })
    return 'ready'
  } catch {
    // Offline or the download failed: the next check tries again.
    return 'failed'
  }
}

/** Installs the downloaded update (Android asks first; the desktop app restarts). */
export function applyUpdate() {
  if (!ready) return
  if (ready.kind === 'android') void Updater.install().catch(() => undefined)
  else void desktop()?.applyUpdate()
}
