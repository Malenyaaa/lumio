import { IconRefresh, IconX } from '@tabler/icons-react'
import { App as CapacitorApp } from '@capacitor/app'
import { registerPlugin } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLocalSettings } from '@/features/settings/local-settings'
import { fetchLatestApps, isNewer } from '@/lib/apps'
import { inCapacitor } from '@/lib/capacitor'
import { desktop } from '@/lib/desktop'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  de: {
    title: (version: string) => `Lumio ${version} ist bereit`,
    desktopBody: 'Beende Lumio, dann wird das Update installiert. Oder jetzt gleich neu starten.',
    debBody: 'Das Paket ist heruntergeladen; installiere es mit deinem Paketmanager.',
    androidBody: 'Das Update ist heruntergeladen. Android fragt beim Installieren noch einmal nach.',
    now: 'Jetzt aktualisieren',
    install: 'Installieren',
    later: 'Später',
  },
  en: {
    title: (version: string) => `Lumio ${version} is ready`,
    desktopBody: 'Quit Lumio and the update is installed. Or restart now.',
    debBody: 'The package is downloaded; install it with your package manager.',
    androidBody: 'The update is downloaded. Android asks once more when installing.',
    now: 'Update now',
    install: 'Install',
    later: 'Later',
  },
})

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

/**
 * Lumio's apps updating themselves. Android: now and then the newest release is looked up; a newer APK is downloaded in
 * the background and offered for installing. Desktop: the main process downloads it (electron/main.mjs) and tells the
 * page; quitting installs it. Either way a card says so. "Update automatically" (settings) turns it off.
 */
export function UpdateReady() {
  const t = useMessages(messages)
  const { settings } = useLocalSettings()
  const [ready, setReady] = useState<Ready | null>(null)
  const [hidden, setHidden] = useState(false)

  // Desktop: the main process announces a downloaded update (also one found before the page loaded).
  useEffect(() => {
    const app = desktop()
    if (!app) return
    const show = (update: { version: string; kind: 'desktop' | 'deb' } | null) => update && setReady(update)
    void app.getUpdate().then(show)
    return app.onUpdateReady(show)
  }, [])

  // Android: look for a newer release, download it in the background.
  useEffect(() => {
    if (!inCapacitor() || !settings.autoUpdate) return
    let stopped = false
    void (async () => {
      try {
        const last = Number(localStorage.getItem(CHECKED_KEY) ?? 0)
        if (Date.now() - last < CHECK_EVERY_MS) return
        localStorage.setItem(CHECKED_KEY, String(Date.now()))
        const [info, release] = await Promise.all([CapacitorApp.getInfo(), fetchLatestApps()])
        const apk = release?.assets.find((asset) => asset.kind === 'android')
        if (!release || !apk || !isNewer(release.version, info.version)) return
        await Updater.download({ url: apk.url })
        if (!stopped) setReady({ version: release.version, kind: 'android' })
      } catch {
        // Offline or the download failed: the next check tries again.
      }
    })()
    return () => {
      stopped = true
    }
  }, [settings.autoUpdate])

  if (!ready || hidden) return null
  const apply = () => {
    if (ready.kind === 'android') void Updater.install().catch(() => undefined)
    else void desktop()?.applyUpdate()
    setHidden(true)
  }
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(1.5rem,calc(var(--bottom-inset)+1rem))] z-[60] mx-auto max-w-md rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-page-in sm:right-6 sm:left-auto sm:mx-0 sm:w-96"
    >
      <div className="flex gap-3">
        <IconRefresh className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">{t.title(ready.version)}</p>
          <p className="text-sm text-muted-foreground">{ready.kind === 'android' ? t.androidBody : ready.kind === 'deb' ? t.debBody : t.desktopBody}</p>
          <Button size="sm" onClick={apply}>
            {ready.kind === 'desktop' ? t.now : t.install}
          </Button>
        </div>
        <button type="button" aria-label={t.later} title={t.later} onClick={() => setHidden(true)} className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  )
}
