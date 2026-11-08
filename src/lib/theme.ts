import { useSyncExternalStore } from 'react'

/** Light or dark look; "system" follows the device. Kept per device, like the language (also on the login page). */
export type ThemePreference = 'system' | 'dark' | 'light'
export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'lumio.theme'
const listeners = new Set<() => void>()
const media = typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: light)')

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'system' || stored === 'dark' || stored === 'light') return stored
  } catch {
    // Not stored: the default.
  }
  return 'dark'
}

let preference: ThemePreference = readPreference()

const resolve = (value: ThemePreference): Theme => (value === 'system' ? (media?.matches ? 'light' : 'dark') : value)

/** Puts the theme on the page: the `dark` class (Tailwind's dark variant), native controls and the browser's bar. */
function apply() {
  const theme = resolve(preference)
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff')
}

function notify() {
  apply()
  for (const listener of listeners) listener()
}

media?.addEventListener('change', () => {
  if (preference === 'system') notify()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Follows theme changes outside React (the desktop app's window buttons). */
export const subscribeTheme = subscribe

export function setThemePreference(value: ThemePreference) {
  preference = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Only for this visit.
  }
  notify()
}

/** Applies the stored theme; called once at start (index.html already did so before the first paint). */
export function initTheme() {
  apply()
}

export function useThemePreference(): [ThemePreference, (value: ThemePreference) => void] {
  const value = useSyncExternalStore(subscribe, () => preference)
  return [value, setThemePreference]
}

/** The theme in effect (with "system" resolved). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => resolve(preference))
}

export const currentTheme = () => resolve(preference)
