import { useEffect, useRef } from 'react'
import { useMessages } from '@/lib/i18n'
import { playerMessages } from './messages'

interface LoadingIndicatorProps {
  /** Real loading progress, 0–100. */
  percent: number
}

const TAU = Math.PI * 2
/** Shortest arc (at 0 %), as a share of the ring. */
const MIN_ARC = 0.06
/** Turns per second while spinning. */
const SPIN = 0.9
/**
 * Progress arrives in jumps (playlist, first segment, buffer filling). Between two real values the ring keeps creeping
 * towards the next likely one, up to this many points ahead, but never past CREEP_CEILING.
 */
const CREEP_AHEAD = 25
const CREEP_CEILING = 95
/** Seconds for the creep to cover about two thirds of its way. */
const CREEP_SECONDS = 3

/**
 * Loading ring: always spinning, with an arc that grows with the loading progress and a tail that fades out behind its
 * head. Drawn on a canvas so the arc length and rotation can be animated every frame.
 */
export function LoadingIndicator({ percent }: LoadingIndicatorProps) {
  const t = useMessages(playerMessages)
  const canvas = useRef<HTMLCanvasElement>(null)
  // The drawing loop reads the latest value without restarting.
  const real = useRef(percent)
  /** When the real value last changed; 0 until the drawing loop starts (it sets the first timestamp). */
  const changedAt = useRef(0)
  useEffect(() => {
    if (percent !== real.current) changedAt.current = performance.now()
    real.current = percent
  }, [percent])

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let size = 0
    let dpr = 1
    const resize = () => {
      dpr = window.devicePixelRatio || 1
      size = element.clientWidth
      element.width = element.height = Math.round(size * dpr)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()

    let level = 0
    let angle = -Math.PI / 2
    let last = performance.now()
    let frame = 0
    if (!changedAt.current) changedAt.current = last

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const value = Math.min(Math.max(real.current, 0), 100)
      const ahead = Math.min(CREEP_CEILING, value + CREEP_AHEAD)
      const creep = ahead > value ? (ahead - value) * (1 - Math.exp(-(now - changedAt.current) / 1000 / CREEP_SECONDS)) : 0
      const target = (value + creep) / 100
      // Ease towards the target: jumps in the real value turn into a smooth growth of the arc.
      level += (target - level) * Math.min(1, dt * 6)
      if (!reduceMotion) angle += dt * TAU * SPIN

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, size, size)
      const center = size / 2
      const width = Math.max(4, size * 0.06)
      const radius = size / 2 - width
      const length = TAU * (MIN_ARC + (1 - MIN_ARC) * level)

      context.lineWidth = width
      context.lineCap = 'round'
      context.globalAlpha = 1
      context.strokeStyle = 'rgba(255,255,255,0.12)'
      context.beginPath()
      context.arc(center, center, radius, 0, TAU)
      context.stroke()

      // The arc in short segments: faint at the tail, bright at the head.
      const tail = angle - length
      const steps = Math.max(12, Math.ceil(length / 0.05))
      context.lineCap = 'butt'
      context.strokeStyle = '#fff'
      for (let i = 0; i < steps; i++) {
        const from = tail + (length * i) / steps
        const to = tail + (length * (i + 1)) / steps + 0.01
        context.globalAlpha = 0.15 + 0.85 * Math.pow((i + 1) / steps, 1.4)
        context.beginPath()
        context.arc(center, center, radius, from, to)
        context.stroke()
      }
      context.globalAlpha = 1
      context.fillStyle = '#fff'
      context.beginPath()
      context.arc(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius, width / 2, 0, TAU)
      context.fill()

      element.setAttribute('aria-valuenow', String(Math.round(level * 100)))
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center animate-in fade-in-0 duration-300">
      <canvas
        ref={canvas}
        role="progressbar"
        aria-label={t.loading}
        aria-valuemin={0}
        aria-valuemax={100}
        className="aspect-square w-[min(22vw,6rem)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      />
    </div>
  )
}
