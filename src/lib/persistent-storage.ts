import { useSyncExternalStore } from 'react'

/**
 * Persistent storage: whether the browser keeps this site's data (downloads, caches, the offline library) for good.
 * Without it, the browser may clear everything by itself when the disk runs low. Checked and asked for right when the
 * site loads. Browsers decide on their own: Chrome and Edge grant it silently to installed or often used sites,
 * Firefox asks the user (some versions only after the user did something on the page), Safari grants it to apps on
 * the home screen. So it is asked on load, and asked again on the first click or key press if the first answer was no;
 * a no after that is final for this visit, and a notice explains what it means for downloads. While the browser shows
 * its own question (Firefox), a notice says what it is about and why to allow it.
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
    return localStorage.getItem(DISMISSED_KEY) === '1'
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

/** Checks on load and asks right away; a no is asked again once the user does something (see above). */
export function initPersistentStorage() {
  if (started || typeof window === 'undefined') return
  started = true
  if (!supported()) return set('unsupported')
  void (async () => {
    try {
      if (await navigator.storage.persisted()) return set('granted')
    } catch {
      return set('unsupported')
    }
    // Blocked by the user in the site's settings: asking again changes nothing.
    if ((await permission()) === 'denied') return set('denied')
    if (await ask()) return set('granted')
    // Some browsers only ask (or only grant) after the user did something on the page.
    const retry = () => {
      window.removeEventListener('pointerdown', retry, true)
      window.removeEventListener('keydown', retry, true)
      void ask().then((granted) => set(granted ? 'granted' : 'denied'))
    }
    if (navigator.userActivation?.hasBeenActive) return retry()
    window.addEventListener('pointerdown', retry, true)
    window.addEventListener('keydown', retry, true)
  })()
}

/** Asks again (the notice's button: a click, so browsers that want one get it). */
export async function requestPersistentStorage() {
  if (!supported()) return false
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
    if (state === 'denied') localStorage.setItem(DISMISSED_KEY, '1')
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
