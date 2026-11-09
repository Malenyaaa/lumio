import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import {
  IconArrowsShuffle,
  IconChevronDown,
  IconHeart,
  IconHeartFilled,
  IconLoader2,
  IconMicrophone2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBackFilled,
  IconPlayerSkipForwardFilled,
  IconPlaylist,
  IconRepeat,
  IconRepeatOnce,
} from '@tabler/icons-react'
import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { FadeImage } from '@/components/media/fade-image'
import { Sheet, SheetBody, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useAuthedSession } from '@/features/auth/session'
import { useSetFavorite } from '@/features/items/queries'
import { DeviceMenu } from '@/features/remote/device-menu'
import { useDominantColor } from '@/lib/dominant-color'
import { externalOf } from '@/lib/external-items'
import { formatClock } from '@/lib/format'
import { defineMessages, useMessages } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import { TrackArtists } from '../track-artists'
import { TrackMenu } from '../track-menu'
import { SleepTimerMenu } from './sleep-timer-menu'
import { useLyrics } from './lyrics'
import { playerBarMessages } from './messages'
import { music as musicPlayer, useMusic } from './music-player'
import { NowPlayingDetails } from './now-playing'
import { closePhonePlayer, setPhoneSheet, usePhonePlayer } from './panel'
import { ArtistLine } from './player-bar'
import { usePlayerControls, usePlayerTime } from './player-controls'
import { SourceLink } from './queue-source'
import { LyricsView, Queue } from './side-panel'

const messages = defineMessages({
  de: { close: 'Player schließen', playingFrom: 'Wiedergabe aus', queueTitle: 'Warteschlange', closeLyrics: 'Songtext schließen' },
  en: { close: 'Close player', playingFrom: 'Playing from', queueTitle: 'Queue', closeLyrics: 'Close lyrics' },
})

/**
 * The phone's full-screen player (as in Spotify): it slides up from the mini player and is swiped down to close. The
 * first screen is the cover (swiped sideways for the next or previous song), the title, the seek bar and the
 * transport; below it scroll the lyrics, the artist, the credits and what comes next. The queue opens as a sheet over
 * it, the full lyrics over all of it. It must sit inside `ListenControlsProvider`.
 */
export function PhonePlayer() {
  const { pathname } = useLocation()
  const phone = usePhonePlayer()
  const { track } = usePlayerControls()
  const open = !!track && phone.openOn === pathname
  return (
    <Sheet open={open} onOpenChange={(next) => !next && closePhonePlayer()}>
      {track && (
        <SheetContent handle={false} className="h-dvh max-h-none rounded-none pb-0 ring-0">
          <Player track={track} />
          {/* Inside the player, so Base UI knows them as nested (a tap in them doesn't close the player). */}
          <QueueSheet open={open && phone.sheet === 'queue'} />
          <LyricsSheet track={track} open={open && phone.sheet === 'lyrics'} />
        </SheetContent>
      )}
    </Sheet>
  )
}

function Player({ track }: { track: BaseItemDto }) {
  const { api } = useAuthedSession()
  const t = useMessages(messages)
  const bar = useMessages(playerBarMessages)
  const state = usePlayerControls()
  const music = useMusic()
  const { source } = music
  const coverOf = (item: BaseItemDto | undefined) => (item ? portraitImageUrl(api, item, { fillHeight: 720 }) : undefined)
  // The songs before and after, whose covers come in from the sides (on this device's queue, or the controlled one's).
  const queue = state.remote ? state.remote.queue : music.queue
  const index = state.remote ? state.remote.index : music.index
  const previous = index > 0 ? queue[index - 1] : undefined
  const next = index >= 0 ? queue[index + 1] : undefined
  const tint = useDominantColor(portraitImageUrl(api, track, { fillHeight: 64 })).data ?? 'rgb(64 64 64)'
  const lyrics = useLyrics(track)
  const hasLyrics = !lyrics.isLoading && !!lyrics.data?.lines.length
  const RepeatIcon = state.repeat === 'one' ? IconRepeatOnce : IconRepeat
  return (
    <SheetBody
      className="px-0 pb-0 transition-[background] duration-700"
      // The cover's color from the top, darkening into the page (it changes with the song).
      style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${tint} 75%, black) 0%, color-mix(in srgb, ${tint} 35%, var(--background)) 55%, var(--background) 100%)` }}
    >
      <SheetTitle className="sr-only">{track.Name}</SheetTitle>
      {/* The first screen: fills the height, the cards below peek in. */}
      <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col px-6 pt-[max(0.75rem,var(--safe-top))] pb-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={closePhonePlayer} aria-label={t.close} className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full outline-none">
            <IconChevronDown className="size-7" />
          </button>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <p className="text-[11px] text-foreground/70">{state.remote ? bar.playingOn(state.remote.name) : t.playingFrom}</p>
            <p className="truncate text-sm font-semibold">
              <SourceLink source={source} />
            </p>
          </div>
          <div className="-mr-2 grid size-10 shrink-0 place-items-center">
            <TrackMenu track={track} visible />
          </div>
        </div>

        <SwipeCover
          trackKey={`${track.Id}:${index}`}
          index={index}
          covers={[coverOf(previous), coverOf(track), coverOf(next)]}
          hasPrevious={!!previous}
          hasNext={!!next}
          onNext={state.next}
          // Swiping back always goes to the song before (the button restarts the song first).
          onPrevious={() => (state.remote ? state.remote.jump(index - 1) : musicPlayer.jump(index - 1))}
        />

        <div className="mt-auto space-y-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold">{track.Name}</p>
              <ArtistLine item={track} className="text-base text-foreground/70" />
            </div>
            {!externalOf(track) && track.Id && <LikeButton key={track.Id} id={track.Id} liked={!!track.UserData?.IsFavorite} />}
          </div>

          <Seek />

          <div className="flex items-center justify-between">
            <Toggle label={state.shuffle ? bar.shuffleOn : bar.shuffleOff} active={state.shuffle} onClick={state.toggleShuffle}>
              <IconArrowsShuffle className="size-6" />
            </Toggle>
            <button type="button" aria-label={bar.previous} onClick={state.previous} className="grid size-12 place-items-center outline-none active:scale-95">
              <IconPlayerSkipBackFilled className="size-8" />
            </button>
            <button
              type="button"
              aria-label={state.playing ? bar.pause : bar.play}
              onClick={state.toggle}
              className="grid size-16 place-items-center rounded-full bg-foreground text-background outline-none transition-transform active:scale-95"
            >
              {state.buffering && !state.playing ? (
                <IconLoader2 className="size-7 animate-spin" />
              ) : state.playing ? (
                <IconPlayerPauseFilled className="size-7" />
              ) : (
                <IconPlayerPlayFilled className="size-7 translate-x-0.5" />
              )}
            </button>
            <button type="button" aria-label={bar.next} onClick={state.next} className="grid size-12 place-items-center outline-none active:scale-95">
              <IconPlayerSkipForwardFilled className="size-8" />
            </button>
            <Toggle
              label={state.repeat === 'off' ? bar.repeatOff : state.repeat === 'all' ? bar.repeatAll : bar.repeatOne}
              active={state.repeat !== 'off'}
              onClick={state.cycleRepeat}
            >
              <RepeatIcon className="size-6" />
            </Toggle>
          </div>

          <div className="flex items-center justify-between">
            <DeviceMenu />
            <div className="flex items-center gap-1">
              <SleepTimerMenu className="size-11" iconClassName="size-5" activeClassName="text-listen" />
              <Toggle label={hasLyrics ? bar.lyrics : bar.noLyrics} active={false} disabled={!hasLyrics} onClick={() => setPhoneSheet('lyrics')}>
                <IconMicrophone2 className="size-5" />
              </Toggle>
              <Toggle label={bar.queue} active={false} onClick={() => setPhoneSheet('queue')}>
                <IconPlaylist className="size-5" />
              </Toggle>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-[max(2rem,var(--safe-bottom))]">
        <NowPlayingDetails track={track} onExpandLyrics={() => setPhoneSheet('lyrics')} />
      </div>
    </SheetBody>
  )
}

/** Space between two covers in the strip. */
const COVER_GAP = 24

/**
 * The cover in a strip with the songs before and after it, as in Spotify: swiped sideways it follows the finger with
 * the neighbouring cover already coming in, and far enough it goes there. When the song changes otherwise (the
 * buttons, the end of a song) the new cover pushes the old one out from the side it comes from.
 */
function SwipeCover({
  trackKey,
  index,
  covers,
  hasPrevious,
  hasNext,
  onNext,
  onPrevious,
}: {
  trackKey: string
  index: number
  covers: [string | undefined, string | undefined, string | undefined]
  hasPrevious: boolean
  hasNext: boolean
  onNext: () => void
  onPrevious: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [animate, setAnimate] = useState(false)
  // A swipe that went through: the strip is already where the new song is.
  const swiped = useRef(false)
  const shown = useRef({ key: trackKey, index })
  const step = () => (box.current?.clientWidth ?? 0) + COVER_GAP

  useLayoutEffect(() => {
    if (shown.current.key === trackKey) return
    const forward = index > shown.current.index ? 1 : index < shown.current.index ? -1 : 0
    shown.current = { key: trackKey, index }
    setAnimate(false)
    if (swiped.current || !forward) {
      swiped.current = false
      setOffset(0)
      return
    }
    // The old cover is now the neighbour: start with it in the middle, then slide the new one in.
    setOffset(forward * step())
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true)
        setOffset(0)
      }),
    )
    return () => cancelAnimationFrame(frame)
  }, [trackKey, index])

  const end = () => {
    if (!start.current) return
    start.current = null
    const width = step()
    const direction = offset < 0 ? 1 : -1
    setAnimate(true)
    if (Math.abs(offset) > width * 0.28 && (direction > 0 ? hasNext : hasPrevious)) {
      swiped.current = true
      setOffset(-direction * width)
      window.setTimeout(() => (direction > 0 ? onNext() : onPrevious()), 220)
    } else setOffset(0)
  }

  return (
    <div
      // As wide as the screen, so the neighbours slide in from its edges.
      className="-mx-6 mt-6 flex flex-1 items-center justify-center overflow-hidden touch-pan-y select-none"
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return
        start.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        const dx = event.clientX - start.current.x
        // Mostly sideways: the strip follows; mostly down, the sheet (closing) gets the gesture.
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(event.clientY - start.current.y)) {
          setAnimate(false)
          // Where there is no song, it only gives a little.
          const blocked = (dx < 0 && !hasNext) || (dx > 0 && !hasPrevious)
          setOffset(blocked ? dx / 4 : dx)
        }
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        start.current = null
        setAnimate(true)
        setOffset(0)
      }}
    >
      <div ref={box} className="relative aspect-square w-[calc(100%_-_3rem)] max-w-[min(calc(100%_-_3rem),48dvh)]">
        <div className={cn('absolute inset-0', animate && 'transition-transform duration-[260ms] ease-out')} style={{ transform: `translateX(${offset}px)` }}>
          {covers.map((cover, slot) => (
            <div
              key={slot}
              className="absolute inset-0 overflow-hidden rounded-md bg-muted shadow-2xl"
              style={{ transform: `translateX(calc(${slot - 1} * (100% + ${COVER_GAP}px)))`, visibility: cover || slot === 1 ? 'visible' : 'hidden' }}
            >
              {cover && <FadeImage key={cover} src={cover} alt="" className="size-full object-cover" draggable={false} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Seek() {
  const t = useMessages(playerBarMessages)
  const { seek } = usePlayerControls()
  const { position, duration } = usePlayerTime()
  const bar = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const fractionAt = (event: PointerEvent) => {
    const rect = bar.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }
  const shown = drag ?? (duration ? position / duration : 0)
  return (
    <div>
      <div
        ref={bar}
        role="slider"
        aria-label={t.position}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={formatClock(position)}
        tabIndex={0}
        onPointerDown={(event) => {
          if (!duration) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDrag(fractionAt(event))
        }}
        onPointerMove={(event) => drag !== null && setDrag(fractionAt(event))}
        onPointerUp={(event) => {
          if (drag === null) return
          seek(fractionAt(event) * duration)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
        className="relative flex h-6 touch-none items-center"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/25">
          <div className="h-full bg-foreground" style={{ width: `${shown * 100}%` }} />
        </div>
        <div className={cn('absolute size-3 -translate-x-1/2 rounded-full bg-foreground shadow transition-transform', drag !== null && 'scale-125')} style={{ left: `${shown * 100}%` }} />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-foreground/70">
        <span>{formatClock(drag !== null ? drag * duration : position)}</span>
        <span>{formatClock(duration)}</span>
      </div>
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
      className={cn('grid size-10 shrink-0 place-items-center outline-none active:scale-90', now ? 'text-listen' : 'text-foreground/80')}
    >
      {now ? <IconHeartFilled className="size-7" /> : <IconHeart className="size-7" />}
    </button>
  )
}

/** A switch that stays lit (with a dot below, as in Spotify) while on. */
function Toggle({ label, active, disabled, onClick, children }: { label: string; active: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn('relative grid size-11 place-items-center outline-none disabled:opacity-35', active ? 'text-listen' : 'text-foreground/85')}
    >
      {children}
      {active && <span className="absolute bottom-0.5 size-1 rounded-full bg-listen" />}
    </button>
  )
}

/** The queue over the player: half the screen, dragged up for all of it. */
function QueueSheet({ open }: { open: boolean }) {
  const t = useMessages(messages)
  return (
    <Sheet open={open} onOpenChange={(next) => !next && setPhoneSheet(null)} snapPoints={[0.7, 1]}>
      <SheetContent className="h-[calc(100dvh-1rem)]">
        <SheetTitle className="px-4 pb-2 text-lg font-bold">{t.queueTitle}</SheetTitle>
        <SheetBody>
          <Queue />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The whole lyrics over all of the screen, sung along on the cover's color (as in Spotify): the song on top, the seek
 * bar and play/pause below. Swiped down (or the chevron), it goes back to the player.
 */
function LyricsSheet({ track, open }: { track: BaseItemDto; open: boolean }) {
  const { api } = useAuthedSession()
  const t = useMessages(messages)
  const bar = useMessages(playerBarMessages)
  const state = usePlayerControls()
  const tint = useDominantColor(portraitImageUrl(api, track, { fillHeight: 64 })).data ?? 'rgb(64 64 64)'
  return (
    <Sheet open={open} onOpenChange={(next) => !next && setPhoneSheet(null)}>
      <SheetContent
        handle={false}
        className="dark h-dvh max-h-none rounded-none pb-0 text-white ring-0"
        style={{ background: `color-mix(in srgb, ${tint} 70%, black)` }}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 pt-[max(0.75rem,var(--safe-top))] pb-2">
          <button type="button" onClick={() => setPhoneSheet(null)} aria-label={t.closeLyrics} className="grid size-10 shrink-0 place-items-center rounded-full outline-none">
            <IconChevronDown className="size-7" />
          </button>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <SheetTitle className="truncate text-sm font-bold">{track.Name}</SheetTitle>
            <p className="truncate text-xs text-white/75">
              <TrackArtists track={track} linked={false} />
            </p>
          </div>
          <div aria-hidden className="size-10 shrink-0" />
        </div>
        <SheetBody className="px-1 [mask-image:linear-gradient(to_bottom,transparent,black_1.5rem,black_calc(100%-3rem),transparent)]">
          <LyricsView track={track} big={false} />
        </SheetBody>
        <div className="shrink-0 space-y-3 px-6 pt-2 pb-[max(1.5rem,var(--safe-bottom))]">
          <Seek />
          <div className="flex justify-center">
            <button
              type="button"
              aria-label={state.playing ? bar.pause : bar.play}
              onClick={state.toggle}
              className="grid size-16 place-items-center rounded-full bg-white text-black outline-none transition-transform active:scale-95"
            >
              {state.buffering && !state.playing ? (
                <IconLoader2 className="size-7 animate-spin" />
              ) : state.playing ? (
                <IconPlayerPauseFilled className="size-7" />
              ) : (
                <IconPlayerPlayFilled className="size-7 translate-x-0.5" />
              )}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
