import { IconHeart, IconHeartFilled, IconLoader2, IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FadeImage } from '@/components/media/fade-image'
import { useAuthedSession } from '@/features/auth/session'
import { useSetFavorite } from '@/features/items/queries'
import { playerBarMessages } from '@/features/listen/player/messages'
import { usePlayerControls, usePlayerTime } from '@/features/listen/player/player-controls'
import { TrackArtists } from '@/features/listen/track-artists'
import { useDominantColor } from '@/lib/dominant-color'
import { externalOf } from '@/lib/external-items'
import { useMessages } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { itemHref } from '@/lib/item-links'
import { cn } from '@/lib/utils'

/**
 * The phone's player: a card floating just above the tabs (as in Spotify), tinted with the cover's color, with a thin
 * progress line along its bottom edge. Tapping it opens the full player (`onOpen`), else the track's album. In Watch and
 * Listen alike; it must sit inside `ListenControlsProvider`.
 */
export function PhoneMiniPlayer({ onOpen }: { onOpen?: () => void }) {
  const { api } = useAuthedSession()
  const navigate = useNavigate()
  const t = useMessages(playerBarMessages)
  const { track, playing, buffering, toggle, remote } = usePlayerControls()
  const cover = track ? portraitImageUrl(api, track, { fillHeight: 96 }) : undefined
  const tint = useDominantColor(cover).data
  if (!track) return null
  return (
    <div
      role="region"
      aria-label={t.player}
      // Raises the bottom inset (index.css), so content and messages stay clear of it.
      data-mini-player
      className="fixed inset-x-2 bottom-[calc(var(--tab-bar-height)+var(--safe-bottom))] z-40 h-14 overflow-hidden rounded-lg shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-300 md:hidden"
      style={{ background: `color-mix(in srgb, ${tint ?? 'var(--muted)'} 55%, var(--background))` }}
    >
      <div className="flex h-full items-center gap-2.5 pr-1 pl-2">
        <button type="button" onClick={() => (onOpen ? onOpen() : void navigate(itemHref(track)))} aria-label={t.openPlayer} className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none">
          <span className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {cover && <FadeImage key={cover} src={cover} alt="" className="size-full object-cover" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{track.Name}</span>
            <span className={cn('block truncate text-xs', remote ? 'font-medium text-listen' : 'text-foreground/70')}>
              {remote ? t.playingOn(remote.name) : <TrackArtists track={track} linked={false} />}
            </span>
          </span>
        </button>
        {!externalOf(track) && track.Id && <LikeButton key={track.Id} id={track.Id} liked={!!track.UserData?.IsFavorite} />}
        <button type="button" onClick={toggle} aria-label={playing ? t.pause : t.play} className="grid size-11 shrink-0 place-items-center outline-none">
          {buffering && !playing ? (
            <IconLoader2 className="size-6 animate-spin" />
          ) : playing ? (
            <IconPlayerPauseFilled className="size-6" />
          ) : (
            <IconPlayerPlayFilled className="size-6" />
          )}
        </button>
      </div>
      <ProgressLine />
    </div>
  )
}

function LikeButton({ id, liked }: { id: string; liked: boolean }) {
  const t = useMessages(playerBarMessages)
  const favorite = useSetFavorite(id)
  const [now, setNow] = useState(liked)
  return (
    <button
      type="button"
      aria-label={now ? t.unlike : t.like}
      aria-pressed={now}
      onClick={() => {
        setNow(!now)
        favorite.mutate(!now)
      }}
      className={cn('grid size-10 shrink-0 place-items-center outline-none', now ? 'text-listen' : 'text-foreground/80')}
    >
      {now ? <IconHeartFilled className="size-5" /> : <IconHeart className="size-5" />}
    </button>
  )
}

function ProgressLine() {
  const { position, duration } = usePlayerTime()
  const fraction = duration ? Math.min(1, position / duration) : 0
  return (
    <div aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-foreground/20">
      <div className="h-full bg-foreground" style={{ width: `${fraction * 100}%` }} />
    </div>
  )
}
