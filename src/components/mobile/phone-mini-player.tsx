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
/** A swipe this far (px) skips to the next or previous track. */
const SKIP_AT = 70

/**
 * Swiping the card sideways, as in Spotify: to the left skips to the next track, to the right goes back one. The
 * content follows the finger and slides out the way it was swiped; a short or vertical move snaps back (and scrolls).
 */
function useTrackSwipe(onNext: () => void, onPrevious: () => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const swiped = useRef(false)
  const [offset, setOffset] = useState(0)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)
  const [dragging, setDragging] = useState(false)
  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      swiped.current = false
      if (event.pointerType === 'mouse' || leaving) return
      start.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
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
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      setOffset(dx)
    },
    onPointerUp: (event: PointerEvent) => {
      const at = start.current
      start.current = null
      setDragging(false)
      if (!at || !swiped.current) return
      const dx = event.clientX - at.x
      if (Math.abs(dx) < SKIP_AT) return setOffset(0)
      const side = dx < 0 ? 'left' : 'right'
      setLeaving(side)
      if (side === 'left') onNext()
      else onPrevious()
      // Out to the side, then the new track comes in from the other one.
      window.setTimeout(() => {
        setLeaving(null)
        setOffset(0)
      }, 180)
    },
    onPointerCancel: () => {
      start.current = null
      setDragging(false)
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
  const style = leaving
    ? { transform: `translateX(${leaving === 'left' ? '-60%' : '60%'})`, opacity: 0, transition: 'transform 180ms ease-in, opacity 180ms ease-in' }
    : { transform: offset ? `translateX(${offset}px)` : undefined, opacity: 1 - Math.min(0.6, Math.abs(offset) / 300), transition: dragging ? 'none' : 'transform 200ms ease-out, opacity 200ms ease-out' }
  return { handlers, style }
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
  const { track, playing, buffering, toggle, remote, next, previous } = usePlayerControls()
  const { index } = useMusic()
  // Back a whole track, as the swipe suggests (the button's "previous" restarts the track a few seconds in).
  const swipe = useTrackSwipe(next, () => (!remote && index > 0 ? music.jump(index - 1) : previous()))
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
      <div className="flex h-full items-center gap-2.5 pr-1 pl-2 will-change-transform" style={swipe.style}>
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
