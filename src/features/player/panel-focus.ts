import { useEffect, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Moves keyboard focus into a player panel when it opens (onto its first control) and back to whatever had it
 * (usually the button that opened it) when it closes. `focusKey` refocuses the first control when the content
 * is swapped, e.g. on entering a submenu.
 */
export function usePanelFocus(ref: RefObject<HTMLElement | null>, focusKey?: unknown) {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    // In a list of choices, start on the selected one.
    const target = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus({ preventScroll: true })
  }, [ref, focusKey])
}

/** Arrow-key navigation between the items of a menu (role="menuitem…"), as menus are expected to behave. */
export function moveMenuFocus(event: KeyboardEvent<HTMLElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)')]
  if (items.length === 0) return
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next = {
    ArrowDown: items[(index + 1) % items.length],
    ArrowUp: items[(index - 1 + items.length) % items.length],
    Home: items[0],
    End: items[items.length - 1],
  }[event.key]
  if (!next) return
  event.preventDefault()
  next.focus()
}
