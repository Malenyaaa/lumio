import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

/**
 * Listen's right-hand panel (as Spotify's): what's playing, the queue, or the lyrics. While music is loaded it never
 * goes away completely: closed, it folds to a thin strip at the edge that opens it again. Opening the queue or the
 * lyrics from the player bar opens the panel on them; closing them goes back to how the panel was before (folded
 * again, if it was).
 */
export type ListenPanel = 'nowPlaying' | 'queue' | 'lyrics' | 'quality'

export interface ListenPanelState {
  view: ListenPanel
  open: boolean
  /** How the panel was before the queue, lyrics or quality were opened, to return to. */
  before: { view: ListenPanel; open: boolean } | null
  /**
   * Big: the panel takes the whole window between header and player bar (the library sidebar hides), for a big cover
   * or for singing along. The queue and the quality then open as a column beside it instead of replacing it.
   */
  expanded: boolean
  beside: Extract<ListenPanel, 'queue' | 'quality'> | null
}

/** What opens beside the big panel rather than in it. */
const BESIDE: ReadonlySet<ListenPanel> = new Set(['queue', 'quality'])

const PANEL_KEY = 'lumio.listen.panel'
let panel: ListenPanelState = (() => {
  const fallback: ListenPanelState = { view: 'nowPlaying', open: true, before: null, expanded: false, beside: null }
  try {
    const stored = JSON.parse(localStorage.getItem(PANEL_KEY) ?? 'null') as Partial<ListenPanelState> | string | null
    // Older versions stored just the view (or "none" for closed).
    if (typeof stored === 'string' || !stored) return fallback
    // Big is for the moment; a new visit starts in the normal layout.
    return { ...fallback, ...stored, expanded: false, beside: null }
  } catch {
    return fallback
  }
})()
const listeners = new Set<() => void>()

function setPanel(next: ListenPanelState) {
  panel = next
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify(next))
  } catch {
    // Not remembered.
  }
  for (const listener of listeners) listener()
}

/**
 * The player bar's queue, lyrics and quality buttons: open the panel on that view, or (when it shows) go back. In the
 * big panel the queue and the quality open in the column beside it, the lyrics swap with the cover.
 */
export function toggleListenPanel(target: Exclude<ListenPanel, 'nowPlaying'>) {
  if (panel.expanded) {
    if (target === 'queue' || target === 'quality') return setPanel({ ...panel, beside: panel.beside === target ? null : target })
    return setPanel({ ...panel, view: panel.view === target ? 'nowPlaying' : target })
  }
  if (panel.open && panel.view === target) return closeListenPanel()
  setPanel({ ...panel, view: target, open: true, before: panel.view === 'nowPlaying' ? { view: panel.view, open: panel.open } : panel.before })
}

/** The panel's fold button: big goes back to normal; queue, lyrics and quality go back to how it was; else it folds. */
export function closeListenPanel() {
  if (panel.expanded) return setListenPanelExpanded(false)
  if (panel.view !== 'nowPlaying') return setPanel({ ...panel, ...(panel.before ?? { view: 'nowPlaying', open: true }), before: null })
  setPanel({ ...panel, view: 'nowPlaying', open: false, before: null })
}

/** The folded strip: opens the panel on what's playing. */
export function openListenPanel() {
  setPanel({ ...panel, view: 'nowPlaying', open: true, before: null })
}

/**
 * Makes the panel big (or normal again). An open queue or quality moves beside the cover while big, and back after.
 * The cover flies from where it was to where it ends up (a View Transition between the two, named `listen-cover`).
 */
export function setListenPanelExpanded(expanded: boolean) {
  if (expanded === panel.expanded) return
  const apply = () => {
    if (expanded) {
      const beside = BESIDE.has(panel.view) ? (panel.view as ListenPanelState['beside']) : null
      return setPanel({ ...panel, open: true, expanded, view: beside ? 'nowPlaying' : panel.view, beside })
    }
    setPanel({ ...panel, expanded, view: panel.beside && panel.view === 'nowPlaying' ? panel.beside : panel.view, beside: null })
  }
  if (!('startViewTransition' in document) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return apply()
  // The cover flies only when it is what's shown before and after; under the lyrics or the queue it is hidden and
  // would flash up as a picture of its own.
  const viewAfter = expanded ? (BESIDE.has(panel.view) ? 'nowPlaying' : panel.view) : panel.beside && panel.view === 'nowPlaying' ? panel.beside : panel.view
  const classes = ['panel-transition', ...(panel.view === 'nowPlaying' && viewAfter === 'nowPlaying' ? ['panel-transition-cover'] : [])]
  // The panel grows or shrinks (and the cover flies); the rest of the page changes as it always does.
  document.documentElement.classList.add(...classes)
  const transition = document.startViewTransition(() => flushSync(apply))
  void transition.finished.finally(() => document.documentElement.classList.remove(...classes))
}

/** Whether the pointer rests on the folded panel: it then peeks out a little, and the content makes room for it. */
let peek = false
const peekListeners = new Set<() => void>()

export function setListenPanelPeek(next: boolean) {
  if (next === peek) return
  peek = next
  for (const listener of peekListeners) listener()
}

export function useListenPanelPeek() {
  return useSyncExternalStore(
    (listener) => {
      peekListeners.add(listener)
      return () => {
        peekListeners.delete(listener)
      }
    },
    () => peek,
  )
}

/** How far the folded panel peeks out while pointed at. */
export const PEEK_WIDTH = 56

export function useListenPanel() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => panel,
  )
}

/**
 * Listen's frame layout, kept per device: the library sidebar's width (or collapsed to icons) and the side panel's
 * width. Both sidebars can be dragged wider or narrower.
 */
export interface ListenLayout {
  left: number
  collapsed: boolean
  right: number
}

export const LEFT_LIMITS = { min: 200, max: 420, collapsed: 72 }
export const RIGHT_LIMITS = { min: 280, max: 520, collapsed: 40 }

const LAYOUT_KEY = 'lumio.listen.layout'
const layoutListeners = new Set<() => void>()
let layout: ListenLayout = (() => {
  const fallback: ListenLayout = { left: 256, collapsed: false, right: 320 }
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as Partial<ListenLayout>) }
  } catch {
    return fallback
  }
})()

export function setListenLayout(patch: Partial<ListenLayout>) {
  layout = { ...layout, ...patch }
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    // Not remembered.
  }
  for (const listener of layoutListeners) listener()
}

export function useListenLayout() {
  return useSyncExternalStore(
    (listener) => {
      layoutListeners.add(listener)
      return () => layoutListeners.delete(listener)
    },
    () => layout,
  )
}
