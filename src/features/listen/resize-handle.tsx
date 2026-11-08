import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  /** Which edge of its panel the handle sits on. */
  edge: 'left' | 'right'
  label: string
  /** Called while dragging with how far (in px) the pointer moved since the drag began. */
  onDrag: (delta: number) => void
  onDragStart?: () => void
  onDoubleClick?: () => void
}

/**
 * A thin grab strip along a sidebar's edge: drag to resize. It shows a line on hover, as in Spotify; the cursor says
 * what it does. Arrow keys resize too, for keyboard users.
 */
export function ResizeHandle({ edge, label, onDrag, onDragStart, onDoubleClick }: ResizeHandleProps) {
  const start = useRef<number | null>(null)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        start.current = event.clientX
        // Keeps the drag when the pointer leaves the strip; harmless if the pointer is already gone.
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Dragging still works while the pointer stays over the strip.
        }
        onDragStart?.()
        document.documentElement.classList.add('cursor-col-resize', 'select-none')
      }}
      onPointerMove={(event) => start.current !== null && onDrag(event.clientX - start.current)}
      onPointerUp={() => {
        start.current = null
        document.documentElement.classList.remove('cursor-col-resize', 'select-none')
      }}
      onPointerCancel={() => {
        start.current = null
        document.documentElement.classList.remove('cursor-col-resize', 'select-none')
      }}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        const step = { ArrowLeft: -16, ArrowRight: 16 }[event.key]
        if (step === undefined) return
        event.preventDefault()
        onDragStart?.()
        onDrag(step)
      }}
      className={cn(
        'group/resize absolute inset-y-0 z-10 w-2 cursor-col-resize outline-none',
        edge === 'right' ? '-right-1' : '-left-1',
      )}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-foreground/40 group-focus-visible/resize:bg-ring" />
    </div>
  )
}
