import { useSyncExternalStore } from 'react'

/**
 * Minimal i18n: every feature keeps its own texts next to its code as `defineMessages({ de: {...}, en: {...} })`.
 * Both languages must have the same keys (checked by the type system); a value is a string or a function for
 * texts with numbers/names in them. Components read the active language's set with `useMessages(...)`, plain
 * functions (toasts, labels computed outside React) with `messagesFor(...)`.
 */

export type Locale = 'de' | 'en'
export type LanguagePreference = 'auto' | Locale

export const LOCALES: Locale[] = ['de', 'en']

// oxlint-disable-next-line typescript/no-explicit-any -- message functions take any arguments
type Message = string | ((...args: any[]) => string)
type Messages = Record<string, Message>
/** The English set must provide every German key with the same shape (string or same function signature). */
type SameShape<T extends Messages> = { [K in keyof T]: T[K] extends (...args: infer A) => string ? (...args: A) => string : string }

export interface MessageSet<T extends Messages> {
  de: T
  en: SameShape<T>
}

export function defineMessages<T extends Messages>(messages: { de: T; en: SameShape<T> }): MessageSet<T> {
  return messages
}

const STORAGE_KEY = 'lumio.language'
const listeners = new Set<() => void>()

function readPreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'de' || stored === 'en' || stored === 'auto') return stored
  } catch {
    // Storage unavailable: follow the browser.
  }
  return 'auto'
}

let preference: LanguagePreference = readPreference()

/** "auto" follows the browser: German for any German locale, English for everything else. */
function resolve(value: LanguagePreference): Locale {
  if (value !== 'auto') return value
  const languages = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    const base = language?.toLowerCase().split('-')[0]
    if (base === 'de' || base === 'en') return base
  }
  return 'en'
}

function applyDocumentLanguage() {
  if (typeof document !== 'undefined') document.documentElement.lang = resolve(preference)
}
applyDocumentLanguage()

export function getLocale(): Locale {
  return resolve(preference)
}

/** BCP 47 tag for Intl formatting (dates, numbers). */
export function getLocaleTag(locale: Locale = getLocale()): string {
  return locale === 'de' ? 'de-DE' : 'en-US'
}

export function setLanguagePreference(value: LanguagePreference) {
  preference = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Kept for this tab only.
  }
  applyDocumentLanguage()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the language.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    preference = readPreference()
    applyDocumentLanguage()
    listener()
  }
  window.addEventListener('storage', onStorage)
  // "auto" follows the browser language, which can change while the app is open.
  window.addEventListener('languagechange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('languagechange', listener)
  }
}

export function useLanguagePreference(): [LanguagePreference, (value: LanguagePreference) => void] {
  const value = useSyncExternalStore(subscribe, () => preference)
  return [value, setLanguagePreference]
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale)
}

/** The texts of `messages` in the active language; re-renders when the language changes. */
export function useMessages<T extends Messages>(messages: MessageSet<T>): T {
  return messages[useLocale()] as T
}

/** Outside React (toasts fired from callbacks, label helpers): the texts in the language active right now. */
export function messagesFor<T extends Messages>(messages: MessageSet<T>): T {
  return messages[getLocale()] as T
}
