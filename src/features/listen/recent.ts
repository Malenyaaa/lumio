import type { Api } from '@jellyfin/sdk'
import { getDisplayPreferenceApi } from '@jellyfin/sdk/lib/utils/api/display-preference-api'
import { useSyncExternalStore } from 'react'
import { CLIENT, PREFS_ID } from './playlists'

/**
 * What the user played from, most recent first: albums, artists, playlists, official playlists, Liked Songs, podcasts
 * (the player's `source` keys, e.g. `playlist:<id>`). Jellyfin only knows single tracks were played, so Lumio keeps
 * this list itself, with the Listen library in the user's display preferences (so it follows them across devices).
 */
const KEEP = 24
const SAVE_AFTER_MS = 3000

let recent: string[] = []
const listeners = new Set<() => void>()
let saver: ((list: string[]) => Promise<void>) | null = null
let saveTimer: number | undefined

function emit() {
  for (const listener of listeners) listener()
}

/** Called when a collection starts playing. */
export function recordRecent(source: string) {
  if (recent[0] === source) return
  recent = [source, ...recent.filter((entry) => entry !== source)].slice(0, KEEP)
  emit()
  if (!saver) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saver?.(recent).catch(() => undefined), SAVE_AFTER_MS)
}

export function useRecentSources() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => recent,
  )
}

/** Connects the list to the signed-in user (by MusicPlayerHost); null on sign-out. */
export async function connectRecent(connection: { api: Api; userId: string } | null) {
  window.clearTimeout(saveTimer)
  recent = []
  saver = null
  emit()
  if (!connection) return
  const prefs = getDisplayPreferenceApi(connection.api)
  const ids = { displayPreferencesId: PREFS_ID, userId: connection.userId, client: CLIENT }
  try {
    const { data } = await prefs.getDisplayPreferences(ids)
    const stored = JSON.parse(data.CustomPrefs?.recent ?? '[]') as string[]
    // Anything played meanwhile stays in front.
    recent = [...recent, ...stored.filter((entry) => !recent.includes(entry))].slice(0, KEEP)
    emit()
  } catch {
    // Starts empty.
  }
  saver = async (list) => {
    // The endpoint replaces the whole record: start from what is stored (the library lives there too).
    const { data } = await prefs.getDisplayPreferences(ids)
    await prefs.updateDisplayPreferences({ ...ids, displayPreferencesDto: { ...data, CustomPrefs: { ...data.CustomPrefs, recent: JSON.stringify(list) } } })
  }
}
