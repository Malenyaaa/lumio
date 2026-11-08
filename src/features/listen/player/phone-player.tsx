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
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
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
import { TrackMenu } from '../track-menu'
import { useLyrics } from './lyrics'
import { playerBarMessages } from './messages'
import { useMusic } from './music-player'
import { NowPlayingDetails } from './now-playing'
import { closePhonePlayer, setPhoneSheet, usePhonePlayer } from './panel'
import { ArtistLine } from './player-bar'
import { usePlayerControls, usePlayerTime } from './player-controls'
import { SourceLink } from './queue-source'
import { LyricsView, Queue } from './side-panel'

const messages = defineMessages({
  de: { close: 'Player schließen', playingFrom: 'Wiedergabe aus', queueTitle: 'Warteschlange', lyricsTitle: 'Songtext' },
  en: { close: 'Close player', playingFrom: 'Playing from', queueTitle: 'Queue', lyricsTitle: 'Lyrics' },
})

/**
 * The phone's full-screen player (as in Spotify): it slides up from the mini player and is swiped down to close. The
 * first screen is the cover (swiped sideways for the next or previous song), the title, the seek bar and the
 * transport; below it scroll the lyrics, the artist, the credits and what comes next. The queue and the full lyrics
 * open as sheets over it. It must sit inside `ListenControlsProvider`.
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
  const { source } = useMusic()
  const cover = portraitImageUrl(api, track, { fillHeight: 720 })
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

        <SwipeCover cover={cover} onNext={state.next} onPrevious={state.previous} />

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
        <NowPlayingDetails track={track} />
      </div>
    </SheetBody>
  )
}

/** The cover; swiped sideways it follows the finger and, far enough, goes to the next or previous song. */
function SwipeCover({ cover, onNext, onPrevious }: { cover?: string; onNext: () => void; onPrevious: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState<-1 | 1 | 0>(0)
  const end = (event: PointerEvent) => {
    if (!start.current) return
    const width = event.currentTarget.clientWidth
    start.current = null
    setDragging(false)
    if (Math.abs(offset) > width * 0.28) {
      const direction = offset < 0 ? -1 : 1
      setLeaving(direction)
      window.setTimeout(() => {
        if (direction < 0) onNext()
        else onPrevious()
        setLeaving(0)
        setOffset(0)
      }, 180)
    } else setOffset(0)
  }
  return (
    <div
      className="mt-6 flex flex-1 items-center justify-center touch-pan-y select-none"
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return
        start.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        const dx = event.clientX - start.current.x
        // Mostly sideways: the cover follows; mostly down, the sheet (closing) gets the gesture.
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(event.clientY - start.current.y)) {
          setDragging(true)
          setOffset(dx)
        }
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        start.current = null
        setDragging(false)
        setOffset(0)
      }}
    >
      <div
        className={cn('aspect-square w-full max-w-[min(100%,48dvh)] overflow-hidden rounded-md bg-muted shadow-2xl', !dragging && 'transition-[transform,opacity] duration-200 ease-out')}
        style={{ transform: leaving ? `translateX(${leaving * 120}%)` : `translateX(${offset}px)`, opacity: leaving ? 0 : 1 }}
      >
        {cover && <FadeImage key={cover} src={cover} alt="" className="size-full object-cover" draggable={false} />}
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

/** The whole lyrics, sung along on the cover's color. */
function LyricsSheet({ track, open }: { track: BaseItemDto; open: boolean }) {
  const { api } = useAuthedSession()
  const t = useMessages(messages)
  const tint = useDominantColor(portraitImageUrl(api, track, { fillHeight: 64 })).data ?? 'rgb(64 64 64)'
  return (
    <Sheet open={open} onOpenChange={(next) => !next && setPhoneSheet(null)}>
      <SheetContent className="h-[calc(100dvh-1rem)] text-white" style={{ background: `color-mix(in srgb, ${tint} 70%, black)` }}>
        <SheetTitle className="px-5 text-base font-bold">
          {t.lyricsTitle} · <span className="font-normal text-white/75">{track.Name}</span>
        </SheetTitle>
        <SheetBody className="px-0">
          <LyricsView track={track} big={false} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
