import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconEye, IconEyeCheck, IconX } from '@tabler/icons-react'
import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import { FadeImage } from '@/components/media/fade-image'
import { WatchedBadge } from '@/components/media/watched-badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthedSession } from '@/features/auth/session'
import { useAlbumTracks, useEpisodes, useSeasons, useSetPlayed } from '@/features/items/queries'
import { formatRuntime, plainText } from '@/lib/format'
import { useMessages } from '@/lib/i18n'
import { landscapeImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import { episodeMessages } from './messages'
import { usePanelFocus } from './panel-focus'
import { useVideoDownloadMessages, useVideoUnavailable, VideoDownloadMark } from './video-download-ui'

interface EpisodePanelProps {
  /** The item being played; a series episode shows its season's episodes, an audio track its album. */
  item: BaseItemDto
  onSelect: (id: string) => void
  onClose: () => void
  /** Playing the exit animation; the player unmounts the panel once it has finished. */
  closing?: boolean
}

interface ListProps extends EpisodePanelProps {
  /** The panel itself: popups are mounted into it so they stay visible in fullscreen (which only shows the player). */
  panel: RefObject<HTMLElement | null>
}

// The scrollbar's space is always reserved (and the bar kept slim): otherwise the list jumps sideways the moment the
// episodes have loaded and it starts to overflow.
const LIST = 'flex-1 space-y-1 overflow-y-auto px-2 pb-4 [scrollbar-color:rgb(255_255_255/0.25)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'

/**
 * In-player episode list (like the "In-Player Episode Preview" plugin): browse the seasons, see what's watched,
 * mark episodes as watched and jump to another one without leaving the player.
 */
// Memoized: the player re-renders several times a second while playing, the list doesn't need to.
export const EpisodePanel = memo(function EpisodePanel({ item, onSelect, onClose, closing }: EpisodePanelProps) {
  const t = useMessages(episodeMessages)
  const isTrack = item.Type === 'Audio'
  const panel = useRef<HTMLElement>(null)
  usePanelFocus(panel)
  return (
    <aside
      ref={panel}
      aria-label={isTrack ? t.chapters : t.episodes}
      // Keep clicks inside the panel from reaching the click surface behind it (which would toggle playback).
      onPointerUp={(event) => event.stopPropagation()}
      inert={closing}
      className={cn(
        'absolute inset-y-0 right-0 z-30 flex w-[min(28rem,100vw)] flex-col border-l border-white/10 bg-black/90 text-white shadow-2xl backdrop-blur-md duration-200',
        closing ? 'pointer-events-none animate-out slide-out-to-right-8 fade-out-0 fill-mode-forwards' : 'animate-in slide-in-from-right-8 fade-in-0',
      )}
    >
      {isTrack ? (
        <TrackList item={item} onSelect={onSelect} onClose={onClose} />
      ) : (
        <SeasonList item={item} onSelect={onSelect} onClose={onClose} panel={panel} />
      )}
    </aside>
  )
})

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useMessages(episodeMessages)
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button variant="ghost" size="icon" aria-label={t.close} onClick={onClose}>
        <IconX />
      </Button>
    </div>
  )
}

function SeasonList({ item, onSelect, onClose, panel }: ListProps) {
  const t = useMessages(episodeMessages)
  const seasons = useSeasons(item.SeriesId ?? undefined)
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const seasonId = picked ?? item.SeasonId ?? undefined
  const episodes = useEpisodes(item.SeriesId ?? undefined, seasonId)

  // Regular seasons first, specials last.
  const ordered = [...(seasons.data ?? [])].sort((a, b) => (a.IndexNumber || 99) - (b.IndexNumber || 99))

  return (
    <>
      <Header title={item.SeriesName ?? t.episodes} onClose={onClose} />
      {/* A dropdown rather than a row of buttons: long-running series have more seasons than fit across the panel. */}
      {ordered.length > 0 && (
        <div className="px-4 pb-3">
          {ordered.length === 1 ? (
            <p className="text-sm text-white/70">{ordered[0]!.Name}</p>
          ) : (
            <Select
              value={seasonId ?? null}
              items={ordered.map((season) => ({ value: season.Id!, label: season.Name ?? '' }))}
              onValueChange={(next) => next && setPicked(next)}
            >
              <SelectTrigger aria-label={t.season} className="h-9 w-auto min-w-40 max-w-full gap-3 border-white/15 bg-white/5 text-white hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                <SelectValue className="truncate" />
              </SelectTrigger>
              <SelectContent container={panel} alignItemWithTrigger={false} align="start">
                {ordered.map((season) => (
                  <SelectItem key={season.Id} value={season.Id!}>
                    {season.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <ul className={LIST}>
        {(episodes.data ?? []).map((episode) => (
          <EpisodeRow key={episode.Id} episode={episode} current={episode.Id === item.Id} onSelect={onSelect} />
        ))}
      </ul>
    </>
  )
}

function TrackList({ item, onSelect, onClose }: Omit<EpisodePanelProps, never>) {
  const t = useMessages(episodeMessages)
  const tracks = useAlbumTracks(item.ParentId)
  return (
    <>
      <Header title={item.Album ?? t.chapters} onClose={onClose} />
      <ul className={LIST}>
        {(tracks.data ?? []).map((track) => (
          <EpisodeRow key={track.Id} episode={track} current={track.Id === item.Id} onSelect={onSelect} />
        ))}
      </ul>
    </>
  )
}

interface EpisodeRowProps {
  episode: BaseItemDto
  current: boolean
  onSelect: (id: string) => void
}

function EpisodeRow({ episode, current, onSelect }: EpisodeRowProps) {
  const t = useMessages(episodeMessages)
  const { api } = useAuthedSession()
  const setPlayed = useSetPlayed(episode.Id!)
  const row = useRef<HTMLLIElement>(null)
  const watched = !!episode.UserData?.Played
  const thumb = landscapeImageUrl(api, episode, { fillWidth: 320 })
  const isTrack = episode.Type === 'Audio'
  const overview = plainText(episode.Overview)
  // Offline, only stored episodes play (as in Listen, the rest is greyed out).
  const downloadT = useVideoDownloadMessages()
  const unavailable = useVideoUnavailable(isTrack ? null : episode.Id) && !isTrack

  // Bring the episode that is playing into view when the panel opens.
  useEffect(() => {
    if (current) row.current?.scrollIntoView({ block: 'center' })
  }, [current])

  return (
    <li ref={row}>
      <div className={cn('group/row flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/10', current && 'bg-white/10')}>
        <button
          type="button"
          disabled={unavailable && !current}
          title={unavailable && !current ? downloadT.unavailable : undefined}
          onClick={() => !current && onSelect(episode.Id!)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40"
        >
          {!isTrack && (
            <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-white/10">
              {thumb && <FadeImage src={thumb} alt="" loading="lazy" className="size-full object-cover" />}
              <WatchedBadge item={episode} className="absolute right-1 top-1" />
              {!!episode.UserData?.PlayedPercentage && !watched && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                  <span className="block h-full bg-primary" style={{ width: `${episode.UserData.PlayedPercentage}%` }} />
                </span>
              )}
            </span>
          )}
          <span className="min-w-0 space-y-0.5">
            <span className={cn('block truncate text-sm font-medium', watched && !current && 'text-white/60')}>
              {episode.IndexNumber != null ? `${episode.IndexNumber}. ` : ''}
              {episode.Name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/60">
              {!isTrack && <VideoDownloadMark itemId={episode.Id} />}
              {current ? t.playing : formatRuntime(episode.RunTimeTicks)}
            </span>
            {overview && <span className="line-clamp-2 block text-xs text-white/70">{overview}</span>}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-pressed={watched}
          aria-label={watched ? t.markUnwatched : t.markWatched}
          title={watched ? t.markUnwatched : t.markWatched}
          disabled={setPlayed.isPending}
          onClick={() => setPlayed.mutate(!watched)}
          className="shrink-0 opacity-60 hover:opacity-100 group-hover/row:opacity-100"
        >
          {watched ? <IconEyeCheck /> : <IconEye />}
        </Button>
      </div>
    </li>
  )
}
