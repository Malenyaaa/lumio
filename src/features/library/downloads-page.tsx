import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconDatabaseExclamation, IconDownload, IconTrash, IconWifiOff } from '@tabler/icons-react'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { Button } from '@/components/ui/button'
import { useAuthedSession } from '@/features/auth/session'
import { offlineItem } from '@/features/listen/offline-library'
import { DownloadGlyph } from '@/features/listen/download-ui'
import {
  removeEpisodeDownload,
  removeVideoDownload,
  useDownloadedVideos,
  useVideoDownloadStats,
  type DownloadedVideo,
} from '@/features/player/video-downloads'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { landscapeImageUrl, portraitImageUrl } from '@/lib/images'
import { playHref } from '@/lib/item-links'
import { useOffline } from '@/lib/network'
import { requestPersistentStorage, usePersistentStorage } from '@/lib/persistent-storage'
import { cn } from '@/lib/utils'

const messages = defineMessages({
  de: {
    title: 'Downloads',
    summary: (count: number, size: string) => `${count === 1 ? '1 Titel' : `${count} Titel`} · ${size}`,
    pending: (count: number) => (count === 1 ? '1 wartet' : `${count} warten`),
    empty: 'Noch nichts heruntergeladen. Filme, Staffeln und einzelne Folgen lädst du auf ihrer Seite herunter.',
    offline: 'Du bist offline: Nur Heruntergeladenes lässt sich abspielen.',
    notPersistent: 'Der Browser speichert Downloads nicht dauerhaft und kann sie jederzeit löschen.',
    retry: 'Erneut versuchen',
    movies: 'Filme',
    series: 'Serien',
    episodes: (count: number) => (count === 1 ? '1 Folge' : `${count} Folgen`),
    season: (number: number) => `Staffel ${number}`,
    removeSeason: 'Staffel entfernen',
    remove: (name: string) => `Download von „${name}“ entfernen`,
    removeSeries: 'Alle entfernen',
    loading: (percent: number) => `Wird heruntergeladen: ${percent} %`,
    queued: 'Wartet auf den Download',
  },
  en: {
    title: 'Downloads',
    summary: (count: number, size: string) => `${count === 1 ? '1 title' : `${count} titles`} · ${size}`,
    pending: (count: number) => `${count} waiting`,
    empty: 'Nothing downloaded yet. Download films, seasons and single episodes on their page.',
    offline: "You're offline: only downloads can be played.",
    notPersistent: "The browser doesn't keep downloads for good and may delete them at any time.",
    retry: 'Try again',
    movies: 'Films',
    series: 'Series',
    episodes: (count: number) => (count === 1 ? '1 episode' : `${count} episodes`),
    season: (number: number) => `Season ${number}`,
    removeSeason: 'Remove season',
    remove: (name: string) => `Remove the download of “${name}”`,
    removeSeries: 'Remove all',
    loading: (percent: number) => `Downloading: ${percent}%`,
    queued: 'Waiting to download',
  },
})

type Messages = (typeof messages)['de']

function useSize() {
  const number = new Intl.NumberFormat(getLocaleTag(useLocale()), { maximumFractionDigits: 1 })
  return (bytes: number) => (bytes >= 1024 ** 3 ? `${number.format(bytes / 1024 ** 3)} GB` : `${number.format(Math.max(bytes, 0) / 1024 ** 2)} MB`)
}

/** How far a download is, or its size once it's there. */
function stateText(t: Messages, entry: DownloadedVideo, size: (bytes: number) => string) {
  if (entry.state.state === 'loading') return t.loading(Math.round(entry.state.share * 100))
  if (entry.state.state === 'queued') return t.queued
  return size(entry.bytes)
}

interface SeriesGroup {
  id: string
  series?: BaseItemDto
  name: string
  seasons: Array<{ id: string; number: number; name: string; episodes: DownloadedVideo[] }>
  count: number
  bytes: number
}

/** The episodes by series and season, in their order. */
function groupSeries(episodes: DownloadedVideo[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>()
  for (const entry of episodes) {
    const item = entry.item!
    const seriesId = item.SeriesId ?? 'unknown'
    const group = groups.get(seriesId) ?? { id: seriesId, series: offlineItem(seriesId), name: item.SeriesName ?? '', seasons: [], count: 0, bytes: 0 }
    const seasonId = item.SeasonId ?? `${seriesId}:${item.ParentIndexNumber ?? 0}`
    let season = group.seasons.find((entry) => entry.id === seasonId)
    if (!season) {
      season = { id: seasonId, number: item.ParentIndexNumber ?? 0, name: offlineItem(seasonId)?.Name ?? item.SeasonName ?? '', episodes: [] }
      group.seasons.push(season)
    }
    season.episodes.push(entry)
    group.count++
    group.bytes += entry.bytes
    groups.set(seriesId, group)
  }
  for (const group of groups.values()) {
    group.seasons.sort((a, b) => (a.number || 99) - (b.number || 99))
    for (const season of group.seasons) season.episodes.sort((a, b) => (a.item?.IndexNumber ?? 0) - (b.item?.IndexNumber ?? 0))
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Watch's downloads: films, and episodes sorted into their series and seasons. Works offline (everything it shows is
 * kept on the device); a click plays what is there.
 */
export function WatchDownloadsPage() {
  const t = useMessages(messages)
  const size = useSize()
  const offline = useOffline()
  const storage = usePersistentStorage()
  const stats = useVideoDownloadStats()
  const all = useDownloadedVideos()
  const movies = all.filter((entry) => entry.item?.Type !== 'Episode')
  const series = groupSeries(all.filter((entry) => entry.item?.Type === 'Episode'))

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-12 pt-20 sm:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        {all.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {[t.summary(stats.count, size(stats.bytes)), stats.pending ? t.pending(stats.pending) : ''].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {offline && (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm">
          <IconWifiOff className="size-4 shrink-0" /> {t.offline}
        </p>
      )}
      {storage.state === 'denied' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-500/10 px-4 py-3 text-sm">
          <IconDatabaseExclamation className="size-4 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1">{t.notPersistent}</span>
          <Button size="sm" variant="outline" onClick={() => void requestPersistentStorage()}>
            {t.retry}
          </Button>
        </div>
      )}

      {all.length === 0 && (
        <div className="grid place-items-center gap-3 py-24 text-center text-muted-foreground">
          <IconDownload className="size-8" />
          <p className="max-w-sm text-sm">{t.empty}</p>
        </div>
      )}

      {movies.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t.movies}</h2>
          <ul className="grid gap-1">
            {movies.map((entry) => (
              <MovieRow key={entry.id} entry={entry} t={t} size={size} />
            ))}
          </ul>
        </section>
      )}

      {series.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">{t.series}</h2>
          {series.map((group) => (
            <SeriesBlock key={group.id} group={group} t={t} size={size} />
          ))}
        </section>
      )}
    </div>
  )
}

function MovieRow({ entry, t, size }: { entry: DownloadedVideo; t: Messages; size: (bytes: number) => string }) {
  const { api } = useAuthedSession()
  const item = entry.item
  const poster = item ? portraitImageUrl(api, item, { fillHeight: 300 }) : undefined
  const done = entry.state.state === 'done'
  return (
    <li className="flex items-center gap-2">
      <Link
        to={item ? (done ? playHref(item) : `/movie/${item.Id}`) : '#'}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-md bg-muted">{poster && <FadeImage src={poster} alt="" loading="lazy" className="size-full object-cover" />}</div>
        <div className="min-w-0">
          <p className="truncate font-medium">{item?.Name ?? '—'}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <StateGlyph entry={entry} />
            {[item?.ProductionYear, stateText(t, entry, size)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>
      <RemoveButton label={t.remove(item?.Name ?? '')} onClick={() => removeVideoDownload(`movie:${entry.id}`)} />
    </li>
  )
}

function SeriesBlock({ group, t, size }: { group: SeriesGroup; t: Messages; size: (bytes: number) => string }) {
  const { api } = useAuthedSession()
  const poster = group.series ? portraitImageUrl(api, group.series, { fillHeight: 300 }) : undefined
  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3 sm:p-4">
      <div className="flex items-center gap-4">
        <Link to={`/show/${group.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-muted">{poster && <FadeImage src={poster} alt="" loading="lazy" className="size-full object-cover" />}</div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold hover:underline">{group.series?.Name ?? group.name}</p>
            <p className="text-sm text-muted-foreground">{[t.episodes(group.count), size(group.bytes)].join(' · ')}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            for (const season of group.seasons) for (const entry of season.episodes) removeEpisodeDownload(entry.id)
          }}
        >
          {t.removeSeries}
        </Button>
      </div>
      {group.seasons.map((season) => {
        const seasonKey = season.episodes[0]?.keys.find((key) => key.startsWith('season:'))
        return (
          <div key={season.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 px-2 pt-2">
              <h3 className="text-sm font-medium text-muted-foreground">{season.name || t.season(season.number)}</h3>
              {seasonKey && (
                <Button variant="ghost" size="xs" onClick={() => removeVideoDownload(seasonKey)}>
                  {t.removeSeason}
                </Button>
              )}
            </div>
            <ul className="grid gap-1">
              {season.episodes.map((entry) => {
                const item = entry.item!
                const thumb = landscapeImageUrl(api, item, { fillWidth: 320 })
                const done = entry.state.state === 'done'
                return (
                  <li key={entry.id} className="flex items-center gap-2">
                    <Link
                      to={done ? playHref(item) : `/show/${group.id}?episode=${item.Id}`}
                      className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36">{thumb && <FadeImage src={thumb} alt="" loading="lazy" className="size-full object-cover" />}</div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.IndexNumber != null ? `${item.IndexNumber}. ` : ''}
                          {item.Name}
                        </p>
                        <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                          <StateGlyph entry={entry} />
                          {stateText(t, entry, size)}
                        </p>
                      </div>
                    </Link>
                    <RemoveButton label={t.remove(item.Name ?? '')} onClick={() => removeEpisodeDownload(entry.id)} />
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function StateGlyph({ entry }: { entry: DownloadedVideo }) {
  const state = entry.state
  return (
    <DownloadGlyph
      state={state.state}
      share={state.state === 'loading' ? state.share : 0}
      className={cn('size-4', state.state === 'queued' ? 'text-muted-foreground' : 'text-listen')}
    />
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} className="shrink-0 text-muted-foreground hover:text-foreground">
      <IconTrash />
    </Button>
  )
}
