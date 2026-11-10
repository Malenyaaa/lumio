import { IconBrightnessAuto, IconSun, IconVolume, IconVolume2, IconVolume3 } from '@tabler/icons-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { SystemControls } from '@/lib/capacitor'
import { defineMessages, useMessages } from '@/lib/i18n'

type Kind = 'brightness' | 'volume'

/** What the swipes show: a level 0..1, or (brightness) the system's automatic brightness. */
interface Level {
  kind: Kind
  value: number
  auto?: boolean
}

const messages = defineMessages({
  de: { auto: 'Auto' },
  en: { auto: 'Auto' },
})

/** A swipe over this share of the picture's height goes from nothing to full. */
const FULL_SWIPE = 0.6
/** Movement before a touch counts as a swipe (shorter ones stay taps). */
const SLOP = 12
/** Pulled this far below no brightness, it switches to the system's automatic brightness. */
const AUTO_BELOW = -0.12

/** Handing the screen its own brightness back waits this long: the next episode's player keeps it instead (no flash). */
const RESET_DELAY_MS = 400
let pendingReset: number | undefined

/** The levels set last, for the next film or episode: brightness ('auto' = the system's), volume. */
const STORE_KEY = 'lumio.player.levels'

function readStored(): { brightness?: number | 'auto'; volume?: number } {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as { brightness?: number | 'auto'; volume?: number }
  } catch {
    return {}
  }
}

function store(patch: { brightness?: number | 'auto'; volume?: number }) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...readStored(), ...patch }))
  } catch {
    // Not kept for the next one.
  }
}

/**
 * Lumio's Android app: swiping up or down on the left half of the video sets the brightness of Lumio's window, on the
 * right half the device's media volume (as in phone video players); pulled below no brightness, it switches to the
 * system's automatic brightness. What was set last applies again to the next film or episode. Gives the pointer
 * handlers for the picture, and the level to show while swiping; `consumed()` tells the tap handler that the touch was
 * a swipe. Touches starting in the top or bottom `deadzone` (percent of the screen's height) are left to the system's
 * bars.
 */
export function useSwipeGestures(enabled: boolean, deadzone: number) {
  const start = useRef<{ x: number; y: number; kind: Kind; from: number; height: number } | null>(null)
  const swiping = useRef(false)
  const pending = useRef<Level | null>(null)
  const frame = useRef(0)
  const [level, setLevel] = useState<Level | null>(null)
  // Where each starts from (kept up to date by the swipes); brightness may follow the system.
  const current = useRef<Record<Kind, number>>({ brightness: 0.5, volume: 0.5 })
  const auto = useRef(true)

  useEffect(() => {
    if (!enabled) return
    window.clearTimeout(pendingReset)
    const saved = readStored()
    if (typeof saved.brightness === 'number') {
      auto.current = false
      current.current.brightness = saved.brightness
      void SystemControls.setBrightness({ value: saved.brightness }).catch(() => undefined)
    } else void SystemControls.getBrightness().then(({ value }) => (current.current.brightness = value)).catch(() => undefined)
    if (typeof saved.volume === 'number') {
      current.current.volume = saved.volume
      void SystemControls.setVolume({ value: saved.volume }).catch(() => undefined)
    } else void SystemControls.getVolume().then(({ value }) => (current.current.volume = value)).catch(() => undefined)
    // Leaving the player gives the screen back its own brightness (not between two episodes, see RESET_DELAY_MS).
    return () => {
      pendingReset = window.setTimeout(() => void SystemControls.resetBrightness().catch(() => undefined), RESET_DELAY_MS)
    }
  }, [enabled])

  // The bar fades a moment after the finger lifts.
  useEffect(() => {
    if (!level || start.current) return
    const timer = window.setTimeout(() => setLevel(null), 700)
    return () => window.clearTimeout(timer)
  }, [level])

  const apply = (next: Level) => {
    current.current[next.kind] = next.value
    if (next.kind === 'brightness') auto.current = !!next.auto
    setLevel(next)
    // At most once a frame to the device.
    pending.current = next
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const latest = pending.current
      if (!latest) return
      if (latest.kind === 'volume') void SystemControls.setVolume({ value: latest.value }).catch(() => undefined)
      else if (latest.auto) void SystemControls.resetBrightness().catch(() => undefined)
      else void SystemControls.setBrightness({ value: latest.value }).catch(() => undefined)
    })
  }

  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      swiping.current = false
      if (!enabled || event.pointerType !== 'touch') return
      const edge = (window.innerHeight * deadzone) / 100
      if (event.clientY < edge || event.clientY > window.innerHeight - edge) return
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
      const raw = at.from - dy / (at.height * FULL_SWIPE)
      if (at.kind === 'brightness' && raw < AUTO_BELOW) apply({ kind: 'brightness', value: 0, auto: true })
      else apply({ kind: at.kind, value: Math.min(1, Math.max(0, raw)) })
    },
    onPointerCancel: () => {
      start.current = null
    },
  }

  /** Ends the touch; true when it was a swipe (then it is no tap). The level set is kept for the next video. */
  const consumed = () => {
    const was = swiping.current
    const kind = start.current?.kind
    start.current = null
    swiping.current = false
    if (was && kind) store({ [kind]: kind === 'brightness' && auto.current ? 'auto' : current.current[kind] })
    if (was && level) setLevel({ ...level })
    return was
  }

  return { handlers, consumed, level }
}

/** Only the level while swiping (not the player's controls, so the picture stays in view): an icon and a bar. */
export function SwipeLevel({ level }: { level: Level | null }) {
  const t = useMessages(messages)
  if (!level) return null
  const percent = Math.round(level.value * 100)
  const Icon = level.kind === 'brightness' ? (level.auto ? IconBrightnessAuto : IconSun) : percent === 0 ? IconVolume3 : percent < 50 ? IconVolume2 : IconVolume
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[22%] z-20 flex justify-center">
      <div className="flex items-center gap-3 rounded-full bg-black/60 px-4 py-2.5 text-white backdrop-blur-sm">
        <Icon className="size-5 shrink-0" />
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${level.auto ? 0 : percent}%` }} />
        </div>
        <span className="w-9 text-right text-sm tabular-nums">{level.auto ? t.auto : `${percent}%`}</span>
      </div>
    </div>
  )
}
