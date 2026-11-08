import { useSyncExternalStore } from 'react'
import type { AppMode } from '@/lib/app-mode'

/** What a search result points at, enough to open or play it again later without searching. */
export type SearchTarget = { kind: 'item'; id: string; type: string } | { kind: 'podcast'; id: string }

/** A result as the search lists it; also what "recent searches" keeps. */
export interface SearchEntry {
  key: string
  href: string
  title: string
  meta: string
  image?: string
  shape: 'poster' | 'square' | 'round'
  target: SearchTarget
}

/** As many as Spotify keeps in view. */
const LIMIT = 10
const keyFor = (userId: string, mode: AppMode) => `lumio.search.recent.${mode}.${userId}`
const listeners = new Set<() => void>()
/** Parsed lists by storage key, reused while the stored text is unchanged (a stable snapshot for React). */
const cache = new Map<string, { raw: string | null; value: SearchEntry[] }>()
const EMPTY: SearchEntry[] = []

function read(key: string): SearchEntry[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    // Not stored on this device.
  }
  const cached = cache.get(key)
  if (cached && cached.raw === raw) return cached.value
  let value = EMPTY
  try {
    value = raw ? (JSON.parse(raw) as SearchEntry[]) : EMPTY
  } catch {
    value = EMPTY
  }
  cache.set(key, { raw, value })
  return value
}

function write(key: string, entries: SearchEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(entries))
  } catch {
    // Not remembered.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The results the user opened or played from the search, newest first, per app and per account on this device. Shown
 * when the field is empty, as in Spotify.
 */
export function useRecentSearches(userId: string, mode: AppMode) {
  const key = keyFor(userId, mode)
  const entries = useSyncExternalStore(subscribe, () => read(key))
  return {
    entries,
    add: (entry: SearchEntry) => write(key, [entry, ...read(key).filter((other) => other.key !== entry.key)].slice(0, LIMIT)),
    remove: (entryKey: string) => write(key, read(key).filter((other) => other.key !== entryKey)),
  }
}
