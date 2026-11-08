import { IconSun, IconVolume, IconVolume2, IconVolume3 } from '@tabler/icons-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { SystemControls } from '@/lib/capacitor'

type Kind = 'brightness' | 'volume'

/** A swipe over this share of the picture's height goes from nothing to full. */
const FULL_SWIPE = 0.6
/** Movement before a touch counts as a swipe (shorter ones stay taps). */
const SLOP = 12

/**
 * Lumio's Android app: swiping up or down on the left half of the video sets the brightness of Lumio's window, on the
 * right half the device's media volume (as in phone video players). Gives the pointer handlers for the picture, and
 * the level to show while swiping; `consumed()` tells the tap handler that the touch was a swipe.
 */
export function useSwipeGestures(enabled: boolean) {
  const start = useRef<{ x: number; y: number; kind: Kind; from: number; height: number } | null>(null)
  const swiping = useRef(false)
  const pending = useRef<{ kind: Kind; value: number } | null>(null)
  const frame = useRef(0)
  const [level, setLevel] = useState<{ kind: Kind; value: number } | null>(null)
  // Where each starts from, read when the player opens (and kept up to date by the swipes).
  const current = useRef<Record<Kind, number>>({ brightness: 0.5, volume: 0.5 })

  useEffect(() => {
    if (!enabled) return
    void SystemControls.getBrightness().then(({ value }) => (current.current.brightness = value)).catch(() => undefined)
    void SystemControls.getVolume().then(({ value }) => (current.current.volume = value)).catch(() => undefined)
    // Leaving the player gives the screen back its own brightness.
    return () => void SystemControls.resetBrightness().catch(() => undefined)
  }, [enabled])

  // The hint fades a moment after the finger lifts.
  useEffect(() => {
    if (!level || start.current) return
    const timer = window.setTimeout(() => setLevel(null), 700)
    return () => window.clearTimeout(timer)
  }, [level])

  const apply = (kind: Kind, value: number) => {
    current.current[kind] = value
    setLevel({ kind, value })
    // At most once a frame to the device.
    pending.current = { kind, value }
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const next = pending.current
      if (!next) return
      if (next.kind === 'volume') void SystemControls.setVolume({ value: next.value }).catch(() => undefined)
      else void SystemControls.setBrightness({ value: next.value }).catch(() => undefined)
    })
  }

  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      swiping.current = false
      if (!enabled || event.pointerType !== 'touch') return
      const rect = event.currentTarget.getBoundingClientRect()
      const kind: Kind = event.clientX - rect.left < rect.width / 2 ? 'brightness' : 'volume'
      start.current = { x: event.clientX, y: event.clientY, kind, from: current.current[kind], height: rect.height }
    },
    onPointerMove: (event: PointerEvent) => {
      const at = start.current
      if (!at) return
      const dy = event.clientY - at.y
      if (!swiping.current) {
        // Sideways or too short: not this gesture.
        if (Math.abs(dy) < SLOP || Math.abs(dy) < Math.abs(event.clientX - at.x)) return
        swiping.current = true
      }
      apply(at.kind, Math.min(1, Math.max(0, at.from - dy / (at.height * FULL_SWIPE))))
    },
    onPointerCancel: () => {
      start.current = null
    },
  }

  /** Ends the touch; true when it was a swipe (then it is no tap). */
  const consumed = () => {
    const was = swiping.current
    start.current = null
    swiping.current = false
    if (was && level) setLevel({ ...level })
    return was
  }

  return { handlers, consumed, level }
}

/** The level while swiping, in the middle of the picture: an icon and a bar. */
export function SwipeLevel({ level }: { level: { kind: Kind; value: number } | null }) {
  if (!level) return null
  const percent = Math.round(level.value * 100)
  const Icon = level.kind === 'brightness' ? IconSun : percent === 0 ? IconVolume3 : percent < 50 ? IconVolume2 : IconVolume
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[22%] z-20 flex justify-center">
      <div className="flex items-center gap-3 rounded-full bg-black/60 px-4 py-2.5 text-white backdrop-blur-sm">
        <Icon className="size-5 shrink-0" />
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>
        <span className="w-9 text-right text-sm tabular-nums">{percent}%</span>
      </div>
    </div>
  )
}
