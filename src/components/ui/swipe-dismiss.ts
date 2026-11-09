import { useCallback, useRef } from 'react'

/** Phones show menus and popovers as sheets from the bottom (index.css); there they follow the finger down. */
const SHEET_QUERY = '(width < 48rem) and (pointer: coarse)'
/** Pulled down this far (or flicked), the sheet closes. */
const CLOSE_PX = 90

/**
 * For a popup shown as a bottom sheet on phones: pulled down from its top (scrolled to the top), it follows the finger
 * and, let go far enough, slides out and closes (Escape, which Base UI closes its popups on); otherwise it springs back.
 * Returns a ref callback for the popup element.
 */
export function useSwipeDismiss() {
  const cleanup = useRef<(() => void) | null>(null)
  return useCallback((popup: HTMLElement | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!popup || !matchMedia(SHEET_QUERY).matches) return
    let start: { y: number; at: number } | null = null
    let offset = 0
    const reset = () => {
      popup.style.transition = 'transform 200ms ease-out'
      popup.style.transform = ''
      offset = 0
    }
    // Only from the top: while the popup (or a list in it, under the finger) is scrolled down, the finger scrolls.
    const scrolled = (target: EventTarget | null) => {
      for (let element = target as HTMLElement | null; element && popup.contains(element); element = element.parentElement) {
        if (element.scrollTop > 0) return true
        if (element === popup) break
      }
      return false
    }
    const onStart = (event: TouchEvent) => {
      start = scrolled(event.target) ? null : { y: event.touches[0]!.clientY, at: event.timeStamp }
      offset = 0
    }
    const onMove = (event: TouchEvent) => {
      if (!start) return
      const dy = event.touches[0]!.clientY - start.y
      if (dy <= 0 && !offset) return
      event.preventDefault()
      offset = Math.max(0, dy)
      popup.style.transition = 'none'
      popup.style.transform = `translateY(${offset}px)`
    }
    const onEnd = (event: TouchEvent) => {
      if (!start || !offset) return
      const fast = offset / Math.max(1, event.timeStamp - start.at) > 0.6
      start = null
      if (offset < CLOSE_PX && !fast) return reset()
      popup.style.transition = 'transform 180ms ease-in'
      popup.style.transform = 'translateY(100%)'
      window.setTimeout(() => popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })), 170)
    }
    popup.addEventListener('touchstart', onStart, { passive: true })
    popup.addEventListener('touchmove', onMove, { passive: false })
    popup.addEventListener('touchend', onEnd)
    popup.addEventListener('touchcancel', reset)
    cleanup.current = () => {
      popup.removeEventListener('touchstart', onStart)
      popup.removeEventListener('touchmove', onMove)
      popup.removeEventListener('touchend', onEnd)
      popup.removeEventListener('touchcancel', reset)
    }
  }, [])
}
