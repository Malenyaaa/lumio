import { IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { messagesFor, useMessages } from '@/lib/i18n'
import { fitLabels, formatNumber, mbitLabel } from './labels'
import { statsMessages, transcodeReasons } from './messages'
import type { Playback } from './playback'
import type { PictureArea } from './video-fit'
import type { VideoFit } from '@/features/settings/local-settings'

interface StatsOverlayProps {
  playback: Playback
  video: RefObject<HTMLVideoElement | null>
  delivery: string
  pictureArea: PictureArea
  /** The fit actually applied (after resolving "auto"). */
  fit?: Exclude<VideoFit, 'auto'>
  screen: { width: number; height: number }
  onClose: () => void
}

const mbit = (bits?: number) => (bits ? mbitLabel(bits, 1) : undefined)
const upper = (value?: string) => value?.toUpperCase()
const join = (...parts: Array<string | number | undefined | null | false>) => parts.filter(Boolean).join(' · ') || '–'

interface Live {
  resolution: string
  buffer: string
  frames: string
}

function readLive(element: HTMLVideoElement | null): Live {
  if (!element) return { resolution: '–', buffer: '–', frames: '–' }
  let ahead = 0
  for (let i = 0; i < element.buffered.length; i++) {
    if (element.buffered.start(i) <= element.currentTime && element.buffered.end(i) >= element.currentTime) ahead = element.buffered.end(i) - element.currentTime
  }
  const quality = element.getVideoPlaybackQuality?.()
  const t = messagesFor(statsMessages)
  return {
    resolution: element.videoWidth ? `${element.videoWidth}×${element.videoHeight}` : '–',
    buffer: `${formatNumber(ahead, 1)} s`,
    frames: quality ? t.droppedFrames(quality.droppedVideoFrames, quality.totalVideoFrames) : '–',
  }
}

const POSITION_KEY = 'lumio.stats.position'
/** Default spot, below the top bar on the left. */
const DEFAULT_POSITION = { x: 16, y: 80 }

function loadPosition() {
  try {
    const stored = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as { x: number; y: number } | null
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored
  } catch {
    // Not available or garbage: use the default.
  }
  return DEFAULT_POSITION
}

/** "Statistik für Interessierte": what is being played and how, updated every second. Can be dragged anywhere. */
export function StatsOverlay({ playback, video, delivery, pictureArea, fit, screen, onClose }: StatsOverlayProps) {
  const [live, setLive] = useState(() => readLive(null))

  // Dragging: the box follows the pointer and stays inside the player; the spot is remembered for next time.
  const box = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(loadPosition)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const clamp = (x: number, y: number) => {
    const element = box.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !parent) return { x, y }
    return {
      x: Math.min(Math.max(0, x), Math.max(0, parent.clientWidth - element.offsetWidth)),
      y: Math.min(Math.max(0, y), Math.max(0, parent.clientHeight - element.offsetHeight)),
    }
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { dx: event.clientX - position.x, dy: event.clientY - position.y }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setPosition(clamp(event.clientX - drag.current.dx, event.clientY - drag.current.dy))
  }
  const onPointerEnd = () => {
    if (!drag.current) return
    drag.current = null
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position))
    } catch {
      // Not critical.
    }
  }
  // A remembered spot can lie outside a smaller window: pull it back in once the box is laid out.
  useEffect(() => {
    setPosition((current) => clamp(current.x, current.y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.width, screen.height])
  useEffect(() => {
    const update = () => setLive(readLive(video.current))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [video])

  const t = useMessages(statsMessages)
  const reasonNames: Record<string, string> = useMessages(transcodeReasons)
  const fitNames = useMessages(fitLabels)
  const { stats } = playback
  const bars =
    pictureArea.width < 1 || pictureArea.height < 1
      ? t.barsDetected(Math.round(pictureArea.width * 100), Math.round(pictureArea.height * 100))
      : t.fullPicture

  const rows: Array<[string, string]> = [
    [t.playback, stats.offline ? t.offlineCopy : delivery],
    ...(stats.transcode
      ? ([
          [t.reason, stats.transcode.reasons.map((reason) => reasonNames[reason] ?? reason).join(', ') || '–'],
          [t.target, join(upper(stats.transcode.container), upper(stats.transcode.videoCodec), upper(stats.transcode.audioCodec))],
        ] as Array<[string, string]>)
      : []),
    [t.source, join(upper(stats.container), mbit(stats.bitrate))],
    [t.video, join(upper(stats.videoCodec), stats.videoRange, stats.width && stats.height && `${stats.width}×${stats.height}`)],
    [t.audio, join(upper(stats.audioCodec), stats.audioChannels && t.channels(stats.audioChannels))],
    [t.decoded, live.resolution],
    [t.screen, screen.width ? `${Math.round(screen.width)}×${Math.round(screen.height)}` : '–'],
    [t.pictureArea, bars],
    [t.fit, fit ? fitNames[fit] : '–'],
    [t.buffer, live.buffer],
    [t.frames, live.frames],
    [t.session, playback.playSessionId.slice(0, 12)],
  ]

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={t.title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        // Clicks here must not reach the click surface behind (which would toggle playback).
        event.stopPropagation()
        onPointerEnd()
      }}
      onPointerCancel={onPointerEnd}
      style={{ left: position.x, top: position.y }}
      className="absolute z-20 w-[min(26rem,calc(100%-2rem))] cursor-grab touch-none select-none rounded-lg bg-black/75 p-3 font-mono text-xs text-white shadow-xl backdrop-blur-sm animate-in fade-in-0 duration-150 active:cursor-grabbing"
    >
      <button
        type="button"
        aria-label={t.close}
        onClick={onClose}
        className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"
      >
        <IconX className="size-4" />
      </button>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pr-6">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-white/50">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
