import { useSyncExternalStore } from 'react'

/** Whether a CSS media query matches; follows changes (rotating, resizing, plugging in a mouse). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

/** Below Tailwind's `md`: the phone layout (bottom tabs, sheets instead of menus). */
export const PHONE_QUERY = '(max-width: 47.999rem)'

export const usePhone = () => useMediaQuery(PHONE_QUERY)

/** A finger rather than a mouse: no hover, so controls that only appear on hover have to be visible. */
export const TOUCH_QUERY = '(hover: none), (pointer: coarse)'

export const useTouch = () => useMediaQuery(TOUCH_QUERY)
