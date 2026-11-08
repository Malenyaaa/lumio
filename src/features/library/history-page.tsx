import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconHistory } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { ExpandingSearch } from '@/components/expanding-search'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { LoadMoreSentinel } from '@/components/media/load-more-sentinel'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthedSession } from '@/features/auth/session'
import { useHistory, useHistorySearch } from '@/features/items/queries'
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

interface Group {
  key: string
  label: string
  entries: Array<{ item: BaseItemDto; playedAt?: Date }>
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

  const items = useMemo(
    () => (searching ? (search.data ?? []) : (browse.data?.pages.flatMap((page) => page.items) ?? [])),
    [searching, search.data, browse.data],
  )

  const groups = useMemo(() => {
    const dayFormat = new Intl.DateTimeFormat(localeTag, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const result: Group[] = []
    for (const item of items) {
      const playedAt = item.UserData?.LastPlayedDate ? new Date(item.UserData.LastPlayedDate) : undefined
      const key = playedAt ? dayKey(playedAt) : 'unknown'
      let group = result.find((entry) => entry.key === key)
      if (!group) {
        group = { key, label: playedAt ? dayLabel(playedAt, t, dayFormat) : t.earlier, entries: [] }
        result.push(group)
      }
      group.entries.push({ item, playedAt })
    }
    return result
  }, [items, t, localeTag])

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
            {group.entries.map(({ item, playedAt }) => {
              // Listen shows square covers with artist and album; Watch 16:9 stills with series and episode.
              const image = listen ? portraitImageUrl(api, item, { fillHeight: 160 }) : landscapeImageUrl(api, item, { fillWidth: 320 })
              const isEpisode = item.Type === 'Episode'
              const title = isEpisode ? item.SeriesName : item.Name
              const subtitle = listen
                ? [artistsOf(item).map((artist) => artist.name).join(', '), item.Album].filter(Boolean).join(' · ')
                : isEpisode
                  ? `S${item.ParentIndexNumber} · E${item.IndexNumber} — ${item.Name}`
                  : item.ProductionYear
              return (
                <li key={item.Id}>
                  <Link
                    to={itemHref(item)}
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
