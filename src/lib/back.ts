import { useEffect, useRef } from 'react'
import { modeHome, modeOf } from '@/lib/app-mode'
import { exitApp, inJellyfinApp, setAppBackHandler } from '@/lib/native-app'

/**
 * The system back button (Android's, inside an app wrapper): it closes what lies on top first (a panel, a menu, a
 * dialog), then goes back a page, then to the app's start page, and only there leaves the app.
 */

type Closer = () => void

/** Open layers that close on back, the newest last. */
const layers: Closer[] = []

interface CloseWatcherLike {
  onclose: (() => void) | null
  destroy(): void
}

/**
 * In the browser (and an installed web app), Chromium's CloseWatcher gets Android's back gesture before it leaves the
 * page. Jellyfin's app handles its back button itself (`goBack`), so there it would only fire twice.
 */
function watchClose(close: Closer): CloseWatcherLike | null {
  const Watcher = (window as { CloseWatcher?: new () => CloseWatcherLike }).CloseWatcher
  if (!Watcher || inJellyfinApp()) return null
  try {
    const watcher = new Watcher()
    watcher.onclose = close
    return watcher
  } catch {
    return null
  }
}

/** While `open`, the back button (and the back gesture) calls `close` (before anything opened earlier). */
export function useBackLayer(open: boolean, close: Closer) {
  const latest = useRef(close)
  useEffect(() => {
    latest.current = close
  })
  useEffect(() => {
    if (!open) return
    const layer: Closer = () => latest.current()
    layers.push(layer)
    const watcher = watchClose(layer)
    return () => {
      watcher?.destroy()
      const at = layers.lastIndexOf(layer)
      if (at >= 0) layers.splice(at, 1)
    }
  }, [open])
}

/** An open menu, popover, select or dialog (Base UI marks its popups `data-open`); they close on Escape. */
const openPopup = () => document.querySelector('[data-open]:is([role=dialog],[role=alertdialog],[role=menu],[role=listbox])')

let navigate: ((to: string) => void) | null = null

/** The router's navigation, for going to the start page when there is no page to go back to. */
export function setBackNavigator(next: (to: string) => void) {
  navigate = next
}

export function goBack() {
  const popup = openPopup()
  if (popup) {
    const target = popup.contains(document.activeElement) ? document.activeElement! : popup
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    return
  }
  const layer = layers.at(-1)
  if (layer) return layer()
  // The router numbers its history entries; 0 is where this visit started.
  const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (index > 0) return window.history.back()
  const { pathname } = window.location
  const home = modeHome(modeOf(pathname))
  // The sign-in page has nothing behind it (the start page would only lead back to it).
  if (pathname !== home && pathname !== '/login' && navigate) return navigate(home)
  exitApp()
}

if (inJellyfinApp()) setAppBackHandler(goBack)
