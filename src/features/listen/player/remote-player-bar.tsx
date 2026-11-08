import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api'
import { IconCast, IconLoader2, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerSkipBackFilled, IconPlayerSkipForwardFilled, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { Slider } from '@/components/ui/slider'
import { useAuthedSession } from '@/features/auth/session'
import type { RemoteTarget } from '@/features/remote/remote-provider'
import { formatClock, secondsToTicks, ticksToSeconds } from '@/lib/format'
import { defineMessages, useMessages } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { artistsOf, itemHref } from '@/lib/item-links'
import { cn } from '@/lib/utils'
import { playCircle } from '../play-circle'
import { playerBarMessages } from './messages'

const POLL_MS = 2000

const messages = defineMessages({
  de: { playingOn: (device: string) => `Wiedergabe auf ${device}`, disconnect: 'Trennen', nothing: 'Dort läuft gerade nichts.' },
  en: { playingOn: (device: string) => `Playing on ${device}`, disconnect: 'Disconnect', nothing: 'Nothing is playing there.' },
})

/**
 * Listen's player bar while Lumio controls another device ("Abspielen auf"): the same bar, but for what plays there —
 * its track, play/pause and skip, a seek bar and the volume, all sent to the device — and a note which device it is.
 */
export function RemotePlayerBar({ target, onDisconnect }: { target: RemoteTarget; onDisconnect: () => void }) {
  const { api, session } = useAuthedSession()
  const t = useMessages(messages)
  const bar = useMessages(playerBarMessages)
  const sessions = useQuery({
    queryKey: ['remote-session', target.sessionId],
    refetchInterval: POLL_MS,
    queryFn: async () => (await getSessionApi(api).getSessions({ controllableByUserId: session.userId })).data,
  })
  const remote = sessions.data?.find((entry) => entry.Id === target.sessionId)
  const item = remote?.NowPlayingItem
  const paused = remote?.PlayState?.IsPaused ?? true
  const reported = remote?.PlayState?.PositionTicks ?? 0
  const duration = item?.RunTimeTicks ?? 0
  const volume = remote?.PlayState?.VolumeLevel ?? 100

  // The device reports every couple of seconds; in between, the position moves on by itself.
  const [now, setNow] = useState(() => Date.now())
  const [lastSeek, setLastSeek] = useState<{ ticks: number; at: number } | null>(null)
  useEffect(() => {
    if (paused || !item) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [paused, item])
  const moved = (since: number) => (paused ? 0 : Math.max(0, now - since) * 10_000)
  const base = lastSeek && lastSeek.at > sessions.dataUpdatedAt ? lastSeek.ticks + moved(lastSeek.at) : reported + moved(sessions.dataUpdatedAt)
  const position = duration ? Math.min(base, duration) : base

  const commands = getSessionApi(api)
  const send = (command: 'PlayPause' | 'NextTrack' | 'PreviousTrack') =>
    void commands.sendPlaystateCommand({ sessionId: target.sessionId, command }).then(() => sessions.refetch())
  const seekTo = (ticks: number) => {
    const clamped = Math.max(0, duration ? Math.min(ticks, duration) : ticks)
    const at = Date.now()
    setLastSeek({ ticks: clamped, at })
    setNow(at)
    void commands.sendPlaystateCommand({ sessionId: target.sessionId, command: 'Seek', seekPositionTicks: clamped }).then(() => sessions.refetch())
  }
  const setVolume = (level: number) =>
    void commands.sendFullGeneralCommand({ sessionId: target.sessionId, generalCommand: { Name: 'SetVolume', Arguments: { Volume: String(level) } } })

  const cover = item ? portraitImageUrl(api, item, { fillHeight: 128 }) : undefined
  return (
    <div
      role="region"
      aria-label={t.playingOn(target.name)}
      className="fixed inset-x-0 bottom-0 z-40 grid h-20 grid-cols-[1fr_auto] items-center gap-4 bg-background px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,40rem)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        {item ? (
          <Link to={itemHref(item)} className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
            {cover && <FadeImage key={cover} src={cover} alt="" className="size-full object-cover" />}
          </Link>
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <IconCast className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item?.Name ?? t.nothing}</p>
          {item && <p className="truncate text-xs text-muted-foreground">{artistsOf(item).map((artist) => artist.name).join(', ') || item.SeriesName}</p>}
          {/* Which device all of this is on. */}
          <p className="flex items-center gap-1 truncate text-xs font-semibold text-listen">
            <IconCast className="size-3.5 shrink-0" /> {t.playingOn(target.name)}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <RoundButton label={bar.previous} onClick={() => send('PreviousTrack')}>
            <IconPlayerSkipBackFilled className="size-4" />
          </RoundButton>
          <button type="button" aria-label={paused ? bar.play : bar.pause} onClick={() => send('PlayPause')} disabled={!item} className={cn('size-9', playCircle.light)}>
            {sessions.isLoading ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : paused ? (
              <IconPlayerPlayFilled className="size-4 translate-x-px" />
            ) : (
              <IconPlayerPauseFilled className="size-4" />
            )}
          </button>
          <RoundButton label={bar.next} onClick={() => send('NextTrack')}>
            <IconPlayerSkipForwardFilled className="size-4" />
          </RoundButton>
        </div>
        <RemoteProgress position={position} duration={duration} onSeek={seekTo} label={bar.position} />
      </div>

      <div className="hidden items-center justify-end gap-2 md:flex">
        <Slider
          aria-label={bar.volume}
          thumbAlignment="center"
          className={cn(
            'w-28 [&_[data-slot=slider-track]]:bg-foreground/20 [&_[data-slot=slider-range]]:rounded-full [&_[data-slot=slider-range]]:bg-foreground',
            '[&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-foreground [&_[data-slot=slider-thumb]]:shadow [&_[data-slot=slider-thumb]]:ring-0!',
            '[&_[data-slot=slider-thumb]]:opacity-0 hover:[&_[data-slot=slider-range]]:bg-listen-hover hover:[&_[data-slot=slider-thumb]]:opacity-100',
          )}
          min={0}
          max={100}
          value={[volume]}
          onValueCommitted={(value) => setVolume(Array.isArray(value) ? value[0]! : value)}
        />
        <button
          type="button"
          onClick={onDisconnect}
          title={t.disconnect}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IconX className="size-3.5" /> {t.disconnect}
        </button>
      </div>
    </div>
  )
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

/** The remote device's position, as the local seek bar shows it; dragging seeks there when let go. */
function RemoteProgress({ position, duration, onSeek, label }: { position: number; duration: number; onSeek: (ticks: number) => void; label: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const fractionAt = (event: PointerEvent) => {
    const rect = track.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }
  const shown = drag ?? (duration ? position / duration : 0)
  return (
    <div className="hidden w-full items-center gap-2 text-[11px] tabular-nums text-muted-foreground sm:flex">
      <span className="w-10 text-right">{formatClock(ticksToSeconds(drag !== null ? drag * duration : position))}</span>
      <div
        ref={track}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(ticksToSeconds(duration))}
        aria-valuenow={Math.round(ticksToSeconds(position))}
        tabIndex={0}
        onKeyDown={(event) => {
          const step = { ArrowLeft: -5, ArrowRight: 5 }[event.key]
          if (step === undefined) return
          event.preventDefault()
          onSeek(position + secondsToTicks(step))
        }}
        onPointerDown={(event) => {
          if (!duration) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDrag(fractionAt(event))
        }}
        onPointerMove={(event) => drag !== null && setDrag(fractionAt(event))}
        onPointerUp={(event) => {
          if (drag === null) return
          onSeek(fractionAt(event) * duration)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
        className="group relative flex h-4 flex-1 cursor-pointer touch-none items-center outline-none"
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/20">
          <div className="h-full rounded-full bg-foreground group-hover:bg-listen-hover" style={{ width: `${shown * 100}%` }} />
        </div>
        <div
          className={cn('absolute size-3 -translate-x-1/2 rounded-full bg-foreground shadow transition-opacity', drag !== null ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          style={{ left: `${shown * 100}%` }}
        />
      </div>
      <span className="w-10">{formatClock(ticksToSeconds(duration))}</span>
    </div>
  )
}
