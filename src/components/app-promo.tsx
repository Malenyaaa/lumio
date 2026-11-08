import { IconDeviceDesktop, IconDeviceMobile, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { NoticeCard } from '@/components/notice-stack'
import { Button } from '@/components/ui/button'
import { useLumioConfig } from '@/features/admin/branding'
import { useSession } from '@/features/auth/session'
import { desktop } from '@/lib/desktop'
import { defineMessages, useMessages } from '@/lib/i18n'
import { inNativeApp } from '@/lib/native-app'
import { setAppDownloadOpen } from '@/lib/apps'
import { devicePlatform, type AppPlatform } from '@/lib/platform'

const NAMES: Record<AppPlatform, string> = { android: 'Android', windows: 'Windows', linux: 'Linux' }

const messages = defineMessages({
  de: {
    title: (platform: AppPlatform) => `Lumio gibt es als App für ${NAMES[platform]}`,
    body: (platform: AppPlatform) =>
      platform === 'android'
        ? 'Musik läuft im Hintergrund weiter, Videos gehen beim Verlassen ins Bild im Bild, und Wischen ändert Helligkeit und Lautstärke.'
        : `Ein eigenes Fenster mit Medientasten, Musik im Infobereich und Start mit dem System${platform === 'linux' ? ' (AppImage oder deb)' : ''}.`,
    download: 'Herunterladen',
    never: 'Nicht mehr anzeigen',
    later: 'Später',
  },
  en: {
    title: (platform: AppPlatform) => `Lumio is available as an app for ${NAMES[platform]}`,
    body: (platform: AppPlatform) =>
      platform === 'android'
        ? 'Music keeps playing in the background, videos go picture in picture when you leave, and swiping sets brightness and volume.'
        : `A window of its own with media keys, music in the tray and starting with the system${platform === 'linux' ? ' (AppImage or deb)' : ''}.`,
    download: 'Download',
    never: "Don't show again",
    later: 'Later',
  },
})

const STORAGE_KEY = 'lumio.appPromo'
/** "Later" asks again after this long. */
const LATER_MS = 14 * 24 * 60 * 60_000
/** It waits a little after the start, so it doesn't greet with a popup. */
const DELAY_MS = 20_000

/** Whether this browser should be pointed to Lumio's app: a system with one, which the admin promotes, not in an app. */
export function useAppPromoted() {
  const config = useLumioConfig().data
  const platform = devicePlatform()
  if (!platform || inNativeApp() || desktop()) return false
  return config?.appPromotion?.[platform] !== false
}

function dismissedUntil(): number {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { until?: number } | null
    return stored?.until ?? 0
  } catch {
    return 0
  }
}

function dismiss(until: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ until }))
  } catch {
    // Only for this visit.
  }
}

/**
 * Once, a while after starting Lumio in a browser on Android, Windows or Linux: a card pointing to the app (where the
 * admin promotes it). "Don't show again" ends it for this device; closing or "Later" asks again in two weeks.
 */
export function AppPromo() {
  const t = useMessages(messages)
  const { session } = useSession()
  const { pathname } = useLocation()
  const promoted = useAppPromoted()
  const platform = devicePlatform()
  const [due, setDue] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!promoted || !session || dismissedUntil() > Date.now()) return
    const timer = window.setTimeout(() => setDue(true), DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [promoted, session])

  // Never over the video player.
  if (!due || closed || !platform || pathname.startsWith('/play/')) return null
  const close = (until: number) => {
    dismiss(until)
    setClosed(true)
  }
  const Icon = platform === 'android' ? IconDeviceMobile : IconDeviceDesktop
  return (
    <NoticeCard
      role="dialog"
      aria-label={t.title(platform)}
      
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">{t.title(platform)}</p>
          <p className="text-sm text-muted-foreground">{t.body(platform)}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                close(Number.MAX_SAFE_INTEGER)
                setAppDownloadOpen(true)
              }}
            >
              {t.download}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => close(Number.MAX_SAFE_INTEGER)}>
              {t.never}
            </Button>
          </div>
        </div>
        <button type="button" aria-label={t.later} title={t.later} onClick={() => close(Date.now() + LATER_MS)} className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
          <IconX className="size-4" />
        </button>
      </div>
    </NoticeCard>
  )
}
