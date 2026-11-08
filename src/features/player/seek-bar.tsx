import { useRef, useState, type PointerEvent } from 'react'
import { formatClock } from '@/lib/format'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { controlsMessages } from './messages'
import type { TrickplayLookup } from './trickplay'
import { FULL_FRAME, type PictureArea } from './video-fit'

interface SeekBarProps {
  currentTime: number
  duration: number
  buffered: number
  onSeek: (seconds: number) => void
  /** Preview thumbnails; without it only the time is shown. */
  frameAt?: TrickplayLookup | null
  /** Picture area without burned-in black bars; thumbnails are cropped to it like the video. */
  pictureArea?: PictureArea
  /** Reports the time being dragged to (null when the drag ends), for the large preview over the video. */
  onScrub?: (seconds: number | null) => void
}

/** Display width of a trickplay thumbnail in the preview bubble. */
const PREVIEW_WIDTH = 176

export function SeekBar({ currentTime, duration, buffered, onSeek, frameAt, pictureArea = FULL_FRAME, onScrub }: SeekBarProps) {
  const t = useMessages(controlsMessages)
  const track = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [scrub, setScrubState] = useState<number | null>(null)
  const setScrub = (fraction: number | null) => {
    setScrubState(fraction)
    onScrub?.(fraction === null ? null : fraction * duration)
  }
  // Measured in the pointer handler (not during render) so the preview bubble can be kept inside the bar.
  const [barWidth, setBarWidth] = useState(0)

  const fractionAt = (event: PointerEvent) => {
    const rect = track.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }

  const played = scrub ?? (duration ? currentTime / duration : 0)
  const tooltipFraction = scrub ?? hover

  return (
    <div
      ref={track}
      role="slider"
      aria-label={t.position}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(played * duration)}
      aria-valuetext={formatClock(played * duration)}
      tabIndex={duration ? 0 : -1}
      onKeyDown={(event) => {
        if (!duration) return
        const step = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5, PageDown: -60, PageUp: 60 }[event.key]
        const target =
          event.key === 'Home' ? 0 : event.key === 'End' ? duration : step !== undefined ? currentTime + step : undefined
        if (target === undefined) return
        // Handled here; the player's own shortcuts (which also use the arrows) must not seek a second time.
        event.preventDefault()
        event.stopPropagation()
        onSeek(Math.min(Math.max(target, 0), duration))
      }}
      className="group relative h-6 cursor-pointer touch-none select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      onPointerDown={(event) => {
        if (!duration) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setScrub(fractionAt(event))
      }}
      onPointerMove={(event) => {
        const fraction = fractionAt(event)
        setBarWidth(event.currentTarget.clientWidth)
        setHover(fraction)
        if (scrub !== null) setScrub(fraction)
      }}
      onPointerUp={(event) => {
        if (scrub === null) return
        onSeek(fractionAt(event) * duration)
        setScrub(null)
      }}
      onPointerCancel={() => setScrub(null)}
      onPointerLeave={() => setHover(null)}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-[height] group-hover:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${played * 100}%` }} />
      </div>
      <div
        className={cn(
          'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform group-hover:scale-100',
          scrub !== null ? 'scale-100' : 'scale-0',
        )}
        style={{ left: `${played * 100}%` }}
      />
      {tooltipFraction !== null && duration > 0 && <PreviewBubble fraction={tooltipFraction} duration={duration} width={barWidth} frameAt={scrub !== null && onScrub ? null : frameAt} area={pictureArea} />}
    </div>
  )
}

interface PreviewBubbleProps {
  fraction: number
  duration: number
  /** Width of the seek bar, used to keep the bubble inside it. */
  width: number
  frameAt?: TrickplayLookup | null
  area: PictureArea
}

function PreviewBubble({ fraction, duration, width, frameAt, area }: PreviewBubbleProps) {
  const seconds = fraction * duration
  const frame = frameAt?.(seconds) ?? null
  const bubbleWidth = frame ? PREVIEW_WIDTH : 56
  // Clamp the center so the bubble never sticks out past the ends of the bar.
  const left = Math.min(Math.max(fraction * width, bubbleWidth / 2), Math.max(width - bubbleWidth / 2, bubbleWidth / 2))
  // Only the picture part of the thumbnail is shown: burned-in bars are cut off, as on the video itself.
  const crop = frame && {
    x: frame.x + area.x * frame.width,
    y: frame.y + area.y * frame.height,
    width: area.width * frame.width,
    height: area.height * frame.height,
  }
  const scale = crop ? PREVIEW_WIDTH / crop.width : 1

  return (
    <div className="pointer-events-none absolute bottom-full mb-2 flex -translate-x-1/2 flex-col items-center gap-1" style={{ left }}>
      {frame && crop && (
        <div
          className="overflow-hidden rounded-md bg-black shadow-lg ring-1 ring-white/20"
          style={{
            width: PREVIEW_WIDTH,
            height: crop.height * scale,
            backgroundImage: `url("${frame.url}")`,
            backgroundSize: `${frame.sheetWidth * scale}px ${frame.sheetHeight * scale}px`,
            backgroundPosition: `-${crop.x * scale}px -${crop.y * scale}px`,
          }}
        />
      )}
      <span className="rounded bg-black/80 px-2 py-1 text-xs tabular-nums text-white">{formatClock(seconds)}</span>
    </div>
  )
}
