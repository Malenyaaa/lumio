import { IconWifiOff } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { useOffline } from '@/lib/network'
import { offlineItem } from './offline-library'
import { useDownloadQueue } from './player/downloads'

const messages = defineMessages({
  de: {
    downloads: 'Downloads',
    now: 'Wird geladen',
    waiting: (n: number) => `Warteschlange (${n})`,
    of: (received: string, total: string) => `${received} von ${total}`,
    offline: 'Offline',
    offlineHint: 'Keine Verbindung: Es spielt nur, was heruntergeladen oder im Cache ist. Anderes ist ausgegraut.',
    more: (n: number) => `und ${n} weitere`,
  },
  en: {
    downloads: 'Downloads',
    now: 'Downloading',
    waiting: (n: number) => `Queue (${n})`,
    of: (received: string, total: string) => `${received} of ${total}`,
    offline: 'Offline',
    offlineHint: 'No connection: only what is downloaded or cached plays. The rest is greyed out.',
    more: (n: number) => `and ${n} more`,
  },
})

/** A song's name for the list (episodes are their download's name). */
function nameOf(id: string, collection?: string) {
  return offlineItem(id)?.Name ?? collection ?? id
}

/**
 * The download manager, as browsers have one: shown in the header while something downloads, with a ring of how far
 * the current song is; opens what is coming in now and what waits.
 */
export function DownloadManagerButton() {
  const t = useMessages(messages)
  const number = new Intl.NumberFormat(getLocaleTag(useLocale()), { maximumFractionDigits: 1 })
  const queue = useDownloadQueue()
  if (!queue.current && !queue.pending.length) return null
  const share = queue.current?.share ?? 0
  const mb = (bytes: number) => `${number.format(bytes / 1024 / 1024)} MB`
  const length = 2 * Math.PI * 9
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={t.downloads} title={t.downloads} className="text-listen" />}>
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray={length}
            strokeDashoffset={length * (1 - Math.max(0.02, share))}
            transform="rotate(-90 12 12)"
            className="transition-[stroke-dashoffset] duration-300"
          />
          <path d="M12 8v8M8 12l4 4l4 -4" stroke="currentColor" strokeWidth={2} />
        </svg>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-bold">{t.downloads}</p>
        <div className="max-h-[60svh] space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]">
          {queue.current && (
            <section className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.now}</p>
              <div className="space-y-1.5">
                <p className="truncate text-sm font-medium">{nameOf(queue.current.id, queue.current.collection)}</p>
                {queue.current.collection && <p className="truncate text-xs text-muted-foreground">{queue.current.collection}</p>}
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-listen transition-[width] duration-300" style={{ width: `${Math.round(share * 100)}%` }} />
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {queue.current.total ? t.of(mb(queue.current.received), mb(queue.current.total)) : mb(queue.current.received)} · {Math.round(share * 100)} %
                </p>
              </div>
            </section>
          )}
          {queue.pending.length > 0 && (
            <section className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.waiting(queue.pending.length)}</p>
              <ul className="divide-y">
                {queue.pending.slice(0, 50).map((entry) => (
                  <li key={entry.id} className="py-1.5">
                    <p className="truncate text-sm">{nameOf(entry.id, entry.collection)}</p>
                    {entry.collection && <p className="truncate text-xs text-muted-foreground">{entry.collection}</p>}
                  </li>
                ))}
              </ul>
              {queue.pending.length > 50 && <p className="text-xs text-muted-foreground">{t.more(queue.pending.length - 50)}</p>}
            </section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** "Offline" in the header while there is no connection (or the server can't be reached). */
export function OfflineBadge() {
  const t = useMessages(messages)
  const offline = useOffline()
  if (!offline) return null
  return (
    <span title={t.offlineHint} className="mr-1 flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
      <IconWifiOff className="size-3.5" /> {t.offline}
    </span>
  )
}
