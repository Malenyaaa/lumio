import { useSyncExternalStore } from 'react'
import { inNativeApp } from '@/lib/native-app'

/**
 * Persistent storage: whether the browser keeps this site's data (downloads, caches, the offline library) for good.
 * Without it, the browser may clear everything by itself when the disk runs low. Checked and asked for right when the
 * site loads. Browsers decide on their own: Chrome and Edge grant it silently to installed or often used sites,
 * Firefox asks the user (some versions only after the user did something on the page), Safari grants it to apps on
 * the home screen. So it is asked on load; a no shows a notice at once (what it means for downloads) and is asked
 * again on the first click or key press. While the browser shows its own question (Firefox), a notice says what it is
 * about and why to allow it. A change in the site's settings while Lumio is open is noticed and checked again.
 * Dismissing the notice hides it for this visit only: a no is said again the next time Lumio opens.
 */
export type PersistentState = 'checking' | 'asking' | 'granted' | 'denied' | 'unsupported'

/** A request still open after this long means the browser is asking the user. */
const ASKING_AFTER_MS = 400

const DISMISSED_KEY = 'lumio.storageNotice.dismissed'

let state: PersistentState = 'checking'
/** Whether the notice is shown (denied, and not dismissed; or shown again by a download). */
let noticeOpen = false
const listeners = new Set<() => void>()

function set(next: PersistentState) {
  state = next
  // The browser's question is explained every time; a no only until the notice is dismissed.
  if (next === 'asking') noticeOpen = true
  else if (next !== 'denied') noticeOpen = false
  else if (!dismissed()) noticeOpen = true
  for (const listener of listeners) listener()
}

function dismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

const supported = () => typeof navigator !== 'undefined' && !!navigator.storage?.persist && !!navigator.storage.persisted

/** What the permission says without asking (Firefox and Chrome know it; null where that can't be told). */
async function permission(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions.query({ name: 'persistent-storage' as PermissionName })).state
  } catch {
    return null
  }
}

async function ask(): Promise<boolean> {
  try {
    if (await navigator.storage.persisted()) return true
    const request = navigator.storage.persist()
    // Not answered at once: the browser shows its question (and waits until the user answers it).
    const timer = window.setTimeout(() => set('asking'), ASKING_AFTER_MS)
    try {
      return await request
    } finally {
      window.clearTimeout(timer)
    }
  } catch {
    return false
  }
}

let started = false
/** Waiting for the first click or key press to ask again. */
let retryArmed = false

function retry() {
  window.removeEventListener('pointerdown', retry, true)
  window.removeEventListener('keydown', retry, true)
  retryArmed = false
  void ask().then((granted) => set(granted ? 'granted' : 'denied'))
}

/** Where it stands, asking when the browser may still say yes. */
async function check() {
  try {
    if (await navigator.storage.persisted()) return set('granted')
  } catch {
    return set('unsupported')
  }
  // Blocked by the user in the site's settings: asking again changes nothing.
  if ((await permission()) === 'denied') return set('denied')
  if (await ask()) return set('granted')
  // Said at once, and asked again once the user does something (some browsers only ask or grant after that).
  set('denied')
  if (retryArmed) return
  retryArmed = true
  window.addEventListener('pointerdown', retry, true)
  window.addEventListener('keydown', retry, true)
}

/** Checks on load and asks right away (see above). */
export function initPersistentStorage() {
  if (started || typeof window === 'undefined') return
  started = true
  // The apps (Jellyfin's, Lumio's own) keep the WebView's data as their app data, which the system doesn't clear to make
  // room; and a WebView can't grant this anyway: there is nothing to ask.
  if (!supported() || inNativeApp()) return set('unsupported')
  void check()
  // Granted or taken away in the site's settings while Lumio is open: checked again.
  void navigator.permissions
    ?.query({ name: 'persistent-storage' as PermissionName })
    .then((status) => status.addEventListener('change', () => void check()))
    .catch(() => undefined)
}

/** Asks again (the notice's button: a click, so browsers that want one get it). */
export async function requestPersistentStorage() {
  if (!supported() || inNativeApp()) return false
  const granted = await ask()
  set(granted ? 'granted' : 'denied')
  return granted
}

export const persistentState = () => state

/** Shows the notice again (starting a download while storage isn't kept for good). */
export function remindPersistentStorage() {
  if (state !== 'denied' || noticeOpen) return
  noticeOpen = true
  for (const listener of listeners) listener()
}

export function dismissStorageNotice() {
  try {
    // Hiding the explanation of the browser's question doesn't hide a later no.
    if (state === 'denied') sessionStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Hidden for this visit only.
  }
  noticeOpen = false
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePersistentStorage() {
  return {
    state: useSyncExternalStore(subscribe, () => state),
    noticeOpen: useSyncExternalStore(subscribe, () => noticeOpen),
  }
}
