import { IconPlaylistAdd } from '@tabler/icons-react'
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** How far a row has to be pulled before letting go adds it. */
const THRESHOLD = 72

/**
 * A finger pulling a song row to the right adds the song to the queue (as in Spotify): the row follows, a green strip
 * with the queue icon appears behind it, and it springs back. Mice and pens are left alone (they drag rows onto
 * playlists instead). The click that ends the gesture is swallowed, so the song doesn't start playing as well.
 */
export function SwipeToQueue({ onQueue, children, className }: { onQueue: () => void; children: ReactNode; className?: string }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swallowClick = useRef(false)
  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState(false)
  const end = () => {
    if (start.current && offset >= THRESHOLD) {
      onQueue()
      navigator.vibrate?.(10)
    }
    start.current = null
    setActive(false)
    setOffset(0)
  }
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onPointerDown={(event: PointerEvent) => {
        if (event.pointerType !== 'touch') return
        start.current = { x: event.clientX, y: event.clientY }
        swallowClick.current = false
      }}
      onPointerMove={(event: PointerEvent) => {
        if (!start.current) return
        const dx = event.clientX - start.current.x
        const dy = event.clientY - start.current.y
        // Scrolling the list (mostly vertical) is not a swipe.
        if (!active && (Math.abs(dy) > 12 || dx < 12)) {
          if (Math.abs(dy) > 12) start.current = null
          return
        }
        setActive(true)
        swallowClick.current = true
        setOffset(Math.max(0, Math.min(dx, THRESHOLD * 1.6)))
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        start.current = null
        setActive(false)
        setOffset(0)
      }}
      onClickCapture={(event) => {
        if (!swallowClick.current) return
        swallowClick.current = false
        event.stopPropagation()
        event.preventDefault()
      }}
      // Vertical scrolling stays the browser's; the sideways pull is ours.
      style={{ touchAction: 'pan-y' }}
    >
      <div aria-hidden className={cn('absolute inset-y-0 left-0 flex items-center bg-listen pl-4 text-listen-foreground', !active && 'transition-[width] duration-200')} style={{ width: offset }}>
        <IconPlaylistAdd className={cn('size-6 transition-transform', offset >= THRESHOLD && 'scale-125')} />
      </div>
      <div className={cn('relative bg-background', !active && 'transition-transform duration-200 ease-out')} style={{ transform: `translateX(${offset}px)` }}>
        {children}
      </div>
    </div>
  )
}
