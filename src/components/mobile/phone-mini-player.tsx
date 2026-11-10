import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconHeart, IconHeartFilled, IconLoader2, IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router'
import { FadeImage } from '@/components/media/fade-image'
import { useAuthedSession } from '@/features/auth/session'
import { useSetFavorite } from '@/features/items/queries'
import { playerBarMessages } from '@/features/listen/player/messages'
import { music, useMusic } from '@/features/listen/player/music-player'
import { usePlayerControls, usePlayerTime } from '@/features/listen/player/player-controls'
import { TrackArtists } from '@/features/listen/track-artists'
import { useDominantColor } from '@/lib/dominant-color'
import { externalOf } from '@/lib/external-items'
import { useMessages } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { itemHref } from '@/lib/item-links'
import { cn } from '@/lib/utils'

/** Movement before a touch counts as a swipe (shorter ones stay taps). */
const SLOP = 10
/** A swipe over this share of the text's width skips to the next or previous track. */
const SKIP_SHARE = 0.3
const SLIDE_MS = 200

/**
 * Swiping the card sideways, as in Spotify: only the title and artist move, the neighbouring track's following them in
 * from the side, at most until it stands where the current one did. Let go past `SKIP_SHARE`, it slides the rest of
 * the way and that track plays; otherwise it springs back. A side without a track (the queue's start or end) doesn't
 * move; vertical moves scroll the page.
 */
function useTrackSwipe(hasPrevious: boolean, hasNext: boolean, onSkip: (side: 'previous' | 'next') => void) {
  const start = useRef<{ x: number; y: number; id: number; width: number } | null>(null)
  const swiped = useRef(false)
  const busy = useRef(false)
  const lane = useRef<HTMLSpanElement>(null)
  const [offset, setOffset] = useState(0)
  // 'drag' follows the finger, 'slide' animates, 'jump' sets without animating (the new track taking its place).
  const [motion, setMotion] = useState<'drag' | 'slide' | 'jump'>('slide')
  const clamp = (dx: number, width: number) => Math.max(hasNext ? -width : 0, Math.min(hasPrevious ? width : 0, dx))
  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      swiped.current = false
      if (event.pointerType === 'mouse' || busy.current || !lane.current) return
      start.current = { x: event.clientX, y: event.clientY, id: event.pointerId, width: lane.current.clientWidth }
    },
    onPointerMove: (event: PointerEvent) => {
      const at = start.current
      if (!at || at.id !== event.pointerId) return
      const dx = event.clientX - at.x
      if (!swiped.current) {
        if (Math.abs(dx) < SLOP) return
        // Mostly vertical: the page scrolls, this is no swipe.
        if (Math.abs(event.clientY - at.y) > Math.abs(dx)) return void (start.current = null)
        swiped.current = true
        setMotion('drag')
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      setOffset(clamp(dx, at.width))
    },
    onPointerUp: (event: PointerEvent) => {
      const at = start.current
      start.current = null
      if (!at || !swiped.current) return
      const dx = clamp(event.clientX - at.x, at.width)
      setMotion('slide')
      if (Math.abs(dx) < at.width * SKIP_SHARE) return setOffset(0)
      // The rest of the way; then the new track stands in the middle and the strip is set back underneath it.
      busy.current = true
      setOffset(dx < 0 ? -at.width : at.width)
      window.setTimeout(() => {
        onSkip(dx < 0 ? 'next' : 'previous')
        setMotion('jump')
        setOffset(0)
        busy.current = false
      }, SLIDE_MS)
    },
    onPointerCancel: () => {
      start.current = null
      setMotion('slide')
      setOffset(0)
    },
    // A swipe ends on one of the buttons: it must not also press it.
    onClickCapture: (event: React.MouseEvent) => {
      if (!swiped.current) return
      swiped.current = false
      event.preventDefault()
      event.stopPropagation()
    },
  }
  const style = {
    transform: offset ? `translateX(${offset}px)` : undefined,
    transition: motion === 'slide' ? `transform ${SLIDE_MS}ms ease-out` : 'none',
  }
  return { handlers, lane, style }
}

/** Title and artists of one track (or, playing elsewhere, which device). */
function TrackText({ track, remote }: { track: BaseItemDto; remote?: { name: string } | null }) {
  const t = useMessages(playerBarMessages)
  return (
    <>
      <span className="block truncate text-sm font-semibold">{track.Name}</span>
      <span className={cn('block truncate text-xs', remote ? 'font-medium text-listen' : 'text-foreground/70')}>
        {remote ? t.playingOn(remote.name) : <TrackArtists track={track} linked={false} />}
      </span>
    </>
  )
}

/**
 * The phone's player: a card floating just above the tabs (as in Spotify), tinted with the cover's color, with a thin
 * progress line along its bottom edge. Tapping it opens the full player (`onOpen`), else the track's album; swiping it
 * sideways skips tracks. In Watch and Listen alike; it must sit inside `ListenControlsProvider`.
 */
export function PhoneMiniPlayer({ onOpen }: { onOpen?: () => void }) {
  const { api } = useAuthedSession()
  const navigate = useNavigate()
  const t = useMessages(playerBarMessages)
  const { track, playing, buffering, toggle, remote } = usePlayerControls()
  const { queue, index, repeat } = useMusic()
  // The neighbours are known from this device's queue only (another device's isn't swiped).
  const previousTrack = !remote && index > 0 ? queue[index - 1] : undefined
  const nextTrack = remote ? undefined : (queue[index + 1] ?? (repeat === 'all' && queue.length > 1 ? queue[0] : undefined))
  // A whole track back, as the swipe shows (the button's "previous" restarts the track a few seconds in).
  const swipe = useTrackSwipe(!!previousTrack, !!nextTrack, (side) => (side === 'next' ? music.next() : music.jump(index - 1)))
  const cover = track ? portraitImageUrl(api, track, { fillHeight: 96 }) : undefined
  const tint = useDominantColor(cover).data
  if (!track) return null
  return (
    <div
      role="region"
      aria-label={t.player}
      // Raises the bottom inset (index.css), so content and messages stay clear of it.
      data-mini-player
      {...swipe.handlers}
      className="[view-transition-name:app-mini-player] touch-pan-y fixed inset-x-2 bottom-[calc(var(--tab-bar-height)+var(--safe-bottom))] z-40 h-14 overflow-hidden rounded-lg shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 md:hidden"
      // The cover's color; until it is known (or for a cover without one), a lighter grey that still stands out.
      style={{ background: tint ? `color-mix(in srgb, ${tint} 75%, var(--background))` : 'color-mix(in srgb, var(--foreground) 22%, var(--background))' }}
    >
      <div className="flex h-full items-center gap-2.5 pr-1 pl-2">
        <button type="button" onClick={() => (onOpen ? onOpen() : void navigate(itemHref(track)))} aria-label={t.openPlayer} className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch text-left outline-none">
          <span className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {cover && <FadeImage key={cover} src={cover} alt="" className="size-full object-cover" />}
          </span>
          {/* Only the text moves: the neighbours wait one width to either side, outside the clipped lane. */}
          <span ref={swipe.lane} className="relative min-w-0 flex-1 self-stretch overflow-hidden">
            <span className="absolute inset-0 flex flex-col justify-center will-change-transform" style={swipe.style}>
              <TrackText track={track} remote={remote} />
              {previousTrack && (
                <span aria-hidden className="absolute inset-0 flex -translate-x-full flex-col justify-center">
                  <TrackText track={previousTrack} />
                </span>
              )}
              {nextTrack && (
                <span aria-hidden className="absolute inset-0 flex translate-x-full flex-col justify-center">
                  <TrackText track={nextTrack} />
                </span>
              )}
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
