import { IconDownload, IconExternalLink } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appDownloadUrl, defaultAppKind, setAppDownloadOpen, useAppDownloadOpen, useLatestApps, type AppKind } from '@/lib/apps'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { APP_DOWNLOAD_URL } from '@/lib/platform'

const messages = defineMessages({
  de: {
    title: 'Lumio als App',
    description: (version: string) => `Version ${version}, direkt von diesem Server. Für dein Gerät ist schon das Richtige gewählt.`,
    loading: 'Die Apps werden gesucht …',
    unavailable: 'Die Apps sind gerade nicht erreichbar.',
    platform: 'System',
    download: 'Herunterladen',
    allReleases: 'Alle Versionen auf GitHub',
    android: 'Android (APK)',
    windows: 'Windows (Installer)',
    appimage: 'Linux (AppImage)',
    deb: 'Linux (deb: Debian, Ubuntu)',
    androidHint: 'Beim Öffnen fragt Android, ob dein Browser Apps installieren darf; das einmal erlauben.',
    windowsHint: 'Windows warnt beim ersten Start, weil der Installer nicht signiert ist: „Weitere Informationen“ → „Trotzdem ausführen“.',
    appimageHint: 'Ausführbar machen (chmod +x) und starten; aktualisiert sich selbst.',
    debHint: 'Mit dem Paketmanager installieren (z. B. sudo apt install ./lumio-….deb).',
  },
  en: {
    title: 'Lumio as an app',
    description: (version: string) => `Version ${version}, straight from this server. The right one for your device is already picked.`,
    loading: 'Looking for the apps …',
    unavailable: "The apps can't be reached right now.",
    platform: 'System',
    download: 'Download',
    allReleases: 'All versions on GitHub',
    android: 'Android (APK)',
    windows: 'Windows (installer)',
    appimage: 'Linux (AppImage)',
    deb: 'Linux (deb: Debian, Ubuntu)',
    androidHint: 'When you open it, Android asks whether your browser may install apps; allow it once.',
    windowsHint: "Windows warns on the first start because the installer isn't signed: “More info” → “Run anyway”.",
    appimageHint: 'Make it executable (chmod +x) and start it; it updates itself.',
    debHint: 'Install it with the package manager (e.g. sudo apt install ./lumio-….deb).',
  },
})

const KINDS: AppKind[] = ['android', 'windows', 'appimage', 'deb']

/** The download dialog for the apps (profile menu, the app hint): this device's system picked, the others selectable. */
export function AppDownloadHost() {
  const open = useAppDownloadOpen()
  return (
    <Dialog open={open} onOpenChange={setAppDownloadOpen}>
      <DialogContent className="sm:max-w-md">{open && <Content />}</DialogContent>
    </Dialog>
  )
}

function Content() {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const release = useLatestApps()
  const [kind, setKind] = useState<AppKind>(defaultAppKind)
  const assets = release.data?.assets ?? []
  const asset = assets.find((entry) => entry.kind === kind)
  const size = asset ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 0 }).format(asset.size / 1_000_000) : ''
  const items = KINDS.filter((entry) => assets.some((available) => available.kind === entry)).map((entry) => ({ value: entry, label: t[entry] }))
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.title}</DialogTitle>
        <DialogDescription>{release.data ? t.description(release.data.version) : release.isLoading ? t.loading : t.unavailable}</DialogDescription>
      </DialogHeader>
      {release.data && (
        <div className="grid gap-4">
          <Select value={kind} items={items} onValueChange={(value) => value && setKind(value as AppKind)}>
            <SelectTrigger aria-label={t.platform} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t[`${kind}Hint`]}</p>
          <Button size="lg" disabled={!asset} render={<a href={asset ? appDownloadUrl(kind) : undefined} download />} onClick={() => setAppDownloadOpen(false)}>
            <IconDownload /> {t.download}
            {size && <span className="font-normal opacity-70">· {size}</span>}
          </Button>
        </div>
      )}
      <a href={release.data?.page || APP_DOWNLOAD_URL} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {t.allReleases} <IconExternalLink className="size-3.5" />
      </a>
    </>
  )
}
