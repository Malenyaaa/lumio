import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useLocation } from 'react-router'
import { scrollRowMessages } from '@/components/media/messages'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface ScrollRowProps {
  children: ReactNode
  /** Classes of the scrolling track (gap, padding). */
  className?: string
  /** Identifies the row on its page, so coming back to that page (history entry) restores how far it was scrolled. */
  restoreKey?: string
  /** The page dashes above the row's right end; off for rows without a heading of their own (they would sit on another one). */
  dashes?: boolean
}

/** Horizontal scroll positions per history entry and row; lives as long as the tab. */
const savedPositions = new Map<string, number>()

/** Share of the visible width one arrow click scrolls (a sliver of the previous page stays in view). */
const PAGE_SHARE = 0.85
/** Pixels of slack so sub-pixel layouts don't leave an arrow showing at the very end. */
const EDGE = 4
/** How far the mouse has to move with the button down before it counts as dragging (below that it is a click). */
const DRAG_THRESHOLD = 6
/** Per-frame slowdown of the glide after letting go of a drag. */
const FRICTION = 0.94

/**
 * Lets a mouse drag the row like a finger swipes it: press, pull sideways, let go, and it glides out. A press that
 * barely moves stays a normal click; one that dragged doesn't open the card it was released on.
 */
function useDragScroll(track: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = track.current
    if (!element) return
    let start: { x: number; left: number; pointer: number } | null = null
    let dragging = false
    let samples: Array<{ x: number; time: number }> = []
    let glide = 0

    const onDown = (event: PointerEvent) => {
      // Touch and pens scroll natively.
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      cancelAnimationFrame(glide)
      start = { x: event.clientX, left: element.scrollLeft, pointer: event.pointerId }
      dragging = false
      samples = [{ x: event.clientX, time: event.timeStamp }]
    }
    const onMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointer) return
      const distance = event.clientX - start.x
      if (!dragging) {
        if (Math.abs(distance) < DRAG_THRESHOLD) return
        dragging = true
        // Keeps the drag going when the pointer leaves the row; fails harmlessly if the pointer is already gone.
        try {
          element.setPointerCapture(event.pointerId)
        } catch {
          // Dragging still works while the pointer stays over the row.
        }
        element.dataset.dragging = ''
        window.getSelection()?.removeAllRanges()
      }
      element.scrollLeft = start.left - distance
      samples.push({ x: event.clientX, time: event.timeStamp })
      samples = samples.filter((sample) => event.timeStamp - sample.time < 100)
    }
    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointer) return
      start = null
      if (!dragging) return
      dragging = false
      delete element.dataset.dragging
      // The release ends a drag, not a click on whatever card is under the pointer.
      const swallow = (click: MouseEvent) => {
        click.preventDefault()
        click.stopPropagation()
      }
      element.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => element.removeEventListener('click', swallow, { capture: true }))
      // Keep the speed of the last moment and let it run out.
      const first = samples[0]
      const last = samples.at(-1)
      if (!first || !last || last.time === first.time || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      let velocity = (-(last.x - first.x) / (last.time - first.time)) * 16
      const step = () => {
        element.scrollLeft += velocity
        velocity *= FRICTION
        if (Math.abs(velocity) > 0.5) glide = requestAnimationFrame(step)
      }
      glide = requestAnimationFrame(step)
    }
    // Images and links would otherwise start the browser's own drag-and-drop.
    const onDragStart = (event: DragEvent) => event.preventDefault()
    // A wheel or touch scroll takes over from a running glide.
    const stopGlide = () => cancelAnimationFrame(glide)

    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    element.addEventListener('dragstart', onDragStart)
    element.addEventListener('wheel', stopGlide, { passive: true })
    return () => {
      cancelAnimationFrame(glide)
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('dragstart', onDragStart)
      element.removeEventListener('wheel', stopGlide)
    }
  }, [track])
}

/**
 * Horizontally scrolling row. When content overflows, arrow buttons appear on hover (pointer devices; touch just
 * swipes) and page through it by about one screen width.
 */
export function ScrollRow({ children, className, restoreKey, dashes = true }: ScrollRowProps) {
  const t = useMessages(scrollRowMessages)
  const track = useRef<HTMLDivElement>(null)
  const { key: historyKey } = useLocation()
  const positionKey = restoreKey ? `${historyKey}:${restoreKey}` : null
  useDragScroll(track)

  // Restore before paint, so the row doesn't visibly jump from the start.
  useLayoutEffect(() => {
    const element = track.current
    const saved = positionKey ? savedPositions.get(positionKey) : undefined
    if (element && saved) element.scrollLeft = saved
  }, [positionKey])
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  // Page indicator: how many arrow-clicks wide the row is, and which of those pages is in view.
  const [pages, setPages] = useState(1)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const element = track.current
    if (!element) return
    const update = () => {
      if (positionKey) savedPositions.set(positionKey, element.scrollLeft)
      setCanLeft(element.scrollLeft > EDGE)
      setCanRight(element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE)
      const step = element.clientWidth * PAGE_SHARE
      const overflow = element.scrollWidth - element.clientWidth
      const count = overflow > EDGE && step > 0 ? 1 + Math.ceil((overflow - EDGE) / step) : 1
      setPages(count)
      setCurrent(element.scrollLeft >= overflow - EDGE ? count - 1 : Math.min(count - 1, Math.round(element.scrollLeft / step)))
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    // Size changes of the row (window resize) and of its content (items arriving, images loading).
    const observer = new ResizeObserver(update)
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    const mutations = new MutationObserver(() => {
      for (const child of element.children) observer.observe(child)
      update()
    })
    mutations.observe(element, { childList: true })
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
      mutations.disconnect()
    }
  }, [positionKey])

  /** Jumps to one of the indicator's pages (the last one is the very end of the row). */
  const goToPage = (index: number) => {
    const element = track.current
    if (!element) return
    const left = index >= pages - 1 ? element.scrollWidth : index * element.clientWidth * PAGE_SHARE
    element.scrollTo({ left, behavior: 'smooth' })
  }

  const page = (direction: 1 | -1) => {
    const element = track.current
    if (!element) return
    // Keep a sliver of the previous page in view so the jump is easy to follow.
    element.scrollBy({ left: direction * element.clientWidth * PAGE_SHARE, behavior: 'smooth' })
  }

  return (
    <div className="group/row relative">
      <div
        ref={track}
        className={cn(
          'flex overflow-x-auto [scrollbar-width:none]',
          // While dragging: no hover effects or previews on the cards sliding past, and no text selection.
          'data-dragging:cursor-grabbing data-dragging:select-none data-dragging:*:pointer-events-none',
          className,
        )}
      >
        {children}
      </div>
      {/* Netflix-style: thin dashes above the row's right end, only while hovering it. Deliberately quieter than the
          hero's pills, which are meant to draw the eye. */}
      {dashes && pages > 1 && (
        <div className="absolute bottom-full right-4 mb-[1.125rem] hidden opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 sm:right-8 [@media(hover:hover)]:flex">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              // Like the arrows, a pointer convenience; keyboard users reach the cards themselves.
              tabIndex={-1}
              aria-label={t.page(index + 1, pages)}
              aria-current={index === current}
              onClick={() => goToPage(index)}
              // The dash is thin; the button around it is a comfortable target.
              className="group/dash px-px py-1.5"
            >
              <span
                className={cn(
                  'block h-0.5 w-3 transition-colors',
                  index === current ? 'bg-foreground/80' : 'bg-foreground/20 group-hover/dash:bg-foreground/50',
                )}
              />
            </button>
          ))}
        </div>
      )}
      <ArrowButton side="left" visible={canLeft} onClick={() => page(-1)} />
      <ArrowButton side="right" visible={canRight} onClick={() => page(1)} />
    </div>
  )
}

function ArrowButton({ side, visible, onClick }: { side: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? IconChevronLeft : IconChevronRight
  const t = useMessages(scrollRowMessages)
  return (
    <button
      type="button"
      // Cards stay reachable by Tab (the row scrolls to them); the arrows are a pointer convenience.
      tabIndex={-1}
      aria-label={side === 'left' ? t.back : t.forward}
      onClick={onClick}
      className={cn(
        'absolute inset-y-0 z-10 hidden w-10 items-center justify-center text-foreground opacity-0 transition-opacity duration-200 sm:w-14',
        '[@media(hover:hover)]:flex hover:[&>svg]:scale-125',
        side === 'left' ? 'left-0 bg-linear-to-r from-background/90 to-transparent' : 'right-0 bg-linear-to-l from-background/90 to-transparent',
        visible ? 'group-hover/row:opacity-100' : 'pointer-events-none',
      )}
    >
      <Icon className="size-7 drop-shadow transition-transform" />
    </button>
  )
}
