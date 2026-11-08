import { IconHistory } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ExpandingSearch } from '@/components/expanding-search'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { LoadMoreSentinel } from '@/components/media/load-more-sentinel'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthedSession } from '@/features/auth/session'
import { useHistory, useHistorySearch } from '@/features/items/queries'
import { episodePath } from '@/features/listen/podcasts'
import { lumioGet } from '@/features/social/social'
import { getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { useAppMode } from '@/lib/app-mode'
import { landscapeImageUrl, portraitImageUrl } from '@/lib/images'
import { artistsOf, itemHref } from '@/lib/item-links'
import { cn } from '@/lib/utils'
import { historyMessages } from './messages'

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayLabel(date: Date, t: (typeof historyMessages)['de'], dayFormat: Intl.DateTimeFormat) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return t.today
  if (dayKey(date) === dayKey(yesterday)) return t.yesterday
  return dayFormat.format(date)
}

/** One line of the history: something from Jellyfin, or a podcast episode (which only Lumio's play log knows). */
interface Row {
  key: string
  href: string
  image?: string
  title: string
  subtitle?: string | number | null
  playedAt?: Date
}

interface Group {
  key: string
  label: string
  entries: Row[]
}

interface PodcastPlay {
  kind?: 'podcast' | 'audio'
  key: string
  title: string
  subtitle?: string
  contextId?: string
  image?: string
  startedAt: number
}

/** The podcast episodes heard lately (Lumio's play log; Jellyfin never sees podcasts), each once, newest first. */
function usePodcastHistory(enabled: boolean) {
  const { session } = useAuthedSession()
  return useQuery({
    queryKey: ['podcast-history', session.userId],
    enabled,
    queryFn: async () => {
      const response = await lumioGet('/me/plays?limit=200')
      // Thrown rather than kept empty: the Lumio server may just not be connected yet.
      if (!response?.ok) throw new Error('Lumio server unavailable')
      const seen = new Set<string>()
      return ((await response.json()) as PodcastPlay[]).filter((play) => play.kind !== 'audio' && !seen.has(play.key) && !!seen.add(play.key))
    },
  })
}

const SEARCH_DEBOUNCE_MS = 300

export function HistoryPage() {
  const { api } = useAuthedSession()
  const t = useMessages(historyMessages)
  const localeTag = getLocaleTag(useLocale())
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(localeTag, { hour: '2-digit', minute: '2-digit' }), [localeTag])
  // Local on purpose: this field only filters the history and is independent of the global search.
  const [value, setValue] = useState('')
  const [term, setTerm] = useState('')
  const searching = term.length > 0

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(value.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [value])

  const mode = useAppMode()
  const listen = mode === 'listen'
  const browse = useHistory(mode)
  const search = useHistorySearch(term, mode)
  const history = searching ? search : browse

  const podcasts = usePodcastHistory(listen)

  const items = useMemo(
    () => (searching ? (search.data ?? []) : (browse.data?.pages.flatMap((page) => page.items) ?? [])),
    [searching, search.data, browse.data],
  )

  const rows = useMemo(() => {
    const fromJellyfin = items.map((item): Row => {
      // Listen shows square covers with artist and album; Watch 16:9 stills with series and episode.
      const isEpisode = item.Type === 'Episode'
      return {
        key: item.Id!,
        href: itemHref(item),
        image: listen ? portraitImageUrl(api, item, { fillHeight: 160 }) : landscapeImageUrl(api, item, { fillWidth: 320 }),
        title: (isEpisode ? item.SeriesName : item.Name) ?? '',
        subtitle: listen
          ? [artistsOf(item).map((artist) => artist.name).join(', '), item.Album].filter(Boolean).join(' · ')
          : isEpisode
            ? `S${item.ParentIndexNumber} · E${item.IndexNumber} — ${item.Name}`
            : item.ProductionYear,
        playedAt: item.UserData?.LastPlayedDate ? new Date(item.UserData.LastPlayedDate) : undefined,
      }
    })
    if (!listen) return fromJellyfin
    const lower = term.toLowerCase()
    // While older songs are still to load, only episodes up to there, so the order stays right.
    const oldest = !searching && browse.hasNextPage ? fromJellyfin.at(-1)?.playedAt?.getTime() : undefined
    const fromPodcasts = (podcasts.data ?? [])
      .filter((play) => (!searching || `${play.title} ${play.subtitle ?? ''}`.toLowerCase().includes(lower)) && (oldest === undefined || play.startedAt >= oldest))
      .map(
        (play): Row => ({
          key: `podcast:${play.key}`,
          href: play.contextId ? episodePath(play.contextId, encodeURIComponent(play.key)) : '/listen/podcasts',
          image: play.image,
          title: play.title,
          subtitle: play.subtitle,
          playedAt: new Date(play.startedAt),
        }),
      )
    if (!fromPodcasts.length) return fromJellyfin
    return [...fromJellyfin, ...fromPodcasts].sort((a, b) => (b.playedAt?.getTime() ?? 0) - (a.playedAt?.getTime() ?? 0))
  }, [items, podcasts.data, listen, api, term, searching, browse.hasNextPage])

  const groups = useMemo(() => {
    const dayFormat = new Intl.DateTimeFormat(localeTag, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const result: Group[] = []
    for (const row of rows) {
      const key = row.playedAt ? dayKey(row.playedAt) : 'unknown'
      let group = result.find((entry) => entry.key === key)
      if (!group) {
        group = { key, label: row.playedAt ? dayLabel(row.playedAt, t, dayFormat) : t.earlier, entries: [] }
        result.push(group)
      }
      group.entries.push(row)
    }
    return result
  }, [rows, t, localeTag])

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-12 pt-20 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <ExpandingSearch value={value} onChange={setValue} label={t.search} />
      </div>

      {/* Shaped like the real list (day heading, rows with a 16:9 thumbnail), so nothing moves when it arrives. */}
      {history.isLoading && (
        <section className="space-y-2" aria-hidden>
          <Skeleton className="h-5 w-24" />
          <ul className="grid gap-1">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 p-2">
                <Skeleton className="aspect-video w-32 shrink-0 rounded-md sm:w-40" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.isSuccess && groups.length === 0 && (
        <div className="grid place-items-center gap-3 py-24 text-center text-muted-foreground">
          <IconHistory className="size-8" />
          <p className="max-w-sm text-sm">
            {searching ? t.noMatches(term) : t.empty}
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          <ul className="grid gap-1">
            {group.entries.map(({ key, href, image, title, subtitle, playedAt }) => {
              return (
                <li key={key}>
                  <Link
                    to={href}
                    className="flex items-center gap-4 rounded-lg p-2 outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className={cn('shrink-0 overflow-hidden rounded-md bg-muted', listen ? 'size-14' : 'aspect-video w-32 sm:w-40')}>
                      {image && <FadeImage src={image} alt="" loading="lazy" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{title}</p>
                      <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                    {playedAt && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.time(timeFormat.format(playedAt))}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {!searching && browse.hasNextPage && (
        <LoadMoreSentinel loading={browse.isFetchingNextPage} onLoadMore={() => void browse.fetchNextPage({ cancelRefetch: false })} />
      )}
    </div>
  )
}
