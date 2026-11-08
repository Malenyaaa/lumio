import type { Api } from '@jellyfin/sdk'
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api'

/**
 * Playback that couldn't be reported (offline, or the server didn't answer): kept on this device and handed in later,
 * so plays and positions of cached songs and episodes still count — the play count and "last played" (history,
 * personal playlists, top artists) and where a film or episode was left. Each play is kept on its own, so a song
 * heard three times offline counts three times; positions are only the latest per item.
 */
export interface PendingPlayback {
  itemId: string
  /** When it happened (ISO date), handed in as the date played. */
  at: string
  /** Heard or seen to the end (counts as a play); otherwise only where it was left. */
  played: boolean
  positionTicks: number
}

const keyFor = (userId: string) => `lumio.playback.outbox.${userId}`

function read(userId: string): PendingPlayback[] {
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]') as PendingPlayback[]
  } catch {
    return []
  }
}

function write(userId: string, entries: PendingPlayback[]) {
  try {
    if (entries.length) localStorage.setItem(keyFor(userId), JSON.stringify(entries.slice(-500)))
    else localStorage.removeItem(keyFor(userId))
  } catch {
    // Not kept (storage full or blocked).
  }
}

let connection: { api: Api; userId: string } | null = null

/** Remembers playback that couldn't be reported. */
export function rememberPlayback(userId: string, entry: PendingPlayback) {
  const entries = read(userId)
  // A position replaces an older one of the same item; plays add up.
  const kept = entry.played ? entries : entries.filter((other) => other.played || other.itemId !== entry.itemId)
  write(userId, [...kept, entry])
}

let flushing = false

/** Hands in what was kept, oldest first; stops at the first failure (still offline) and tries again later. */
export async function flushPlayback() {
  if (!connection || flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  const { api, userId } = connection
  const entries = read(userId)
  if (!entries.length) return
  flushing = true
  const userData = getUserDataApi(api)
  let done = 0
  try {
    for (const entry of entries) {
      if (entry.played) await userData.markPlayedItem({ itemId: entry.itemId, userId, datePlayed: entry.at })
      else
        await userData.updateItemUserData({
          itemId: entry.itemId,
          userId,
          updateUserItemDataDto: { PlaybackPositionTicks: entry.positionTicks, LastPlayedDate: entry.at },
        })
      done++
    }
  } catch {
    // Still offline (or the item is gone); what is left stays for the next try.
  } finally {
    // Entries remembered while handing in stay too.
    write(userId, read(userId).slice(done))
    flushing = false
  }
}

/** Set while signed in (MusicPlayerHost): what is kept goes out now and whenever the connection comes back. */
export function connectPlaybackOutbox(next: typeof connection) {
  connection = next
  void flushPlayback()
}

if (typeof window !== 'undefined') window.addEventListener('online', () => void flushPlayback())
