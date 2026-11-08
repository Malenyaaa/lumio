import { useSyncExternalStore } from 'react'
import { lumioGet } from '@/features/social/social'

/**
 * Downloads, as Spotify's: albums, playlists and podcast episodes kept on this device for good, in their own quality,
 * never dropped to make room (unlike the cache, see audio-cache). A downloaded song always plays from here, whatever
 * the streaming quality. Collections stay in step with their source: songs added to a downloaded playlist are fetched,
 * removed ones dropped (when no other download holds them). Changing the download quality fetches everything again.
 *
 * The files sit in Cache Storage; an index in localStorage knows the collections, their songs and the quality.
 */
const CACHE_NAME = 'lumio-downloads-v1'
const INDEX_KEY = 'lumio.downloads.v1'

export const downloadsAvailable = typeof window !== 'undefined' && 'caches' in window

interface Collection {
  name: string
  /** The songs it holds (download ids, see downloadId). */
  ids: string[]
  /** Where entries from outside the library (podcast episodes) are fetched from, by download id. */
  urls?: Record<string, string>
  added: number
}

interface Index {
  /** The quality the files are in (kbps; null = the original file). */
  quality: number | null
  /** Downloaded files by track id. */
  tracks: Record<string, { bytes: number; added: number }>
  /** What was downloaded, by key (`album:<id>`, `playlist:<id>`, `liked`, `official:<slug>`, `episode:<guid>`). */
  collections: Record<string, Collection>
}

let index: Index = (() => {
  try {
    return { quality: null, tracks: {}, collections: {}, ...(JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}') as Partial<Index>) }
  } catch {
    return { quality: null, tracks: {}, collections: {} }
  }
})()

/** Songs waiting to be downloaded, in order. */
let pending: string[] = []
let running = false
/** Bumped on every change, for the hooks. */
let version = 0
const listeners = new Set<() => void>()

/** Builds the address a song is downloaded from (in the download quality); set by the player once signed in. */
let source: ((trackId: string, quality: number | null) => string) | null = null

function changed() {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // Kept for this visit only.
  }
  version++
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const requestFor = (id: string) => new Request(`https://lumio.downloads/audio/${encodeURIComponent(id)}`)

/** Episodes (from outside the library) are kept by their feed GUID, library songs by their id. */
export const downloadId = (item: { Id?: string | null }, guid?: string) => (guid ? `podcast:${guid}` : (item.Id ?? ''))

/** Where a download is fetched from: an episode's own file, or the library song in the download quality. */
function urlFor(id: string, quality: number | null) {
  for (const collection of Object.values(index.collections)) if (collection.urls?.[id]) return collection.urls[id]
  return id.startsWith('podcast:') ? null : (source?.(id, quality) ?? null)
}

/** The track ids any download holds. */
function wanted() {
  return new Set(Object.values(index.collections).flatMap((collection) => collection.ids))
}

/** Lines up what is wanted but not there yet, and drops files nothing holds any more. */
async function reconcile() {
  const want = wanted()
  pending = [...want].filter((id) => !index.tracks[id])
  const unused = Object.keys(index.tracks).filter((id) => !want.has(id))
  if (unused.length && downloadsAvailable) {
    const cache = await caches.open(CACHE_NAME)
    for (const id of unused) {
      await cache.delete(requestFor(id)).catch(() => undefined)
      delete index.tracks[id]
    }
  }
  changed()
  void run()
}

/**
 * Fetches a download: library songs straight from Jellyfin; podcast episodes through the Lumio server (most podcast
 * hosts don't let browsers read their files), straight from the host only without it.
 */
async function fetchAudio(id: string, url: string) {
  if (!id.startsWith('podcast:')) return fetch(url)
  const relayed = await lumioGet(`/podcast-audio?url=${encodeURIComponent(url)}`).catch(() => null)
  return relayed?.ok ? relayed : fetch(url)
}

/** Downloads the pending songs one after another; stops when offline and goes on once back. */
async function run() {
  if (running || !source || !downloadsAvailable) return
  running = true
  try {
    const cache = await caches.open(CACHE_NAME)
    while (pending.length && source) {
      const id = pending[0]!
      const quality = index.quality
      try {
        const url = urlFor(id, quality)
        if (!url) throw new Error('No source')
        const response = await fetchAudio(id, url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        // The quality may have changed meanwhile: then this file is stale.
        if (quality !== index.quality) continue
        await cache.put(requestFor(id), new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg', 'Content-Length': String(blob.size) } }))
        if (wanted().has(id)) index.tracks[id] = { bytes: blob.size, added: Date.now() }
        else await cache.delete(requestFor(id))
        pending = pending.filter((entry) => entry !== id)
        changed()
      } catch {
        // Offline or the server failed: tried again when the connection is back.
        if (!navigator.onLine) break
        pending = [...pending.filter((entry) => entry !== id), id]
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  } finally {
    running = false
    changed()
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => void run())

/** Set by the player when signed in: where songs are downloaded from. Starts what is pending. */
export function setDownloadSource(next: typeof source) {
  source = next
  if (next) void reconcile()
}

/**
 * The download quality changed (the settings): every file is fetched again in the new one. Downloads stay downloads;
 * until a song is fetched again, it streams.
 */
export async function setDownloadQuality(quality: number | null) {
  if (index.quality === quality) return
  index.quality = quality
  // Library songs only: episodes are their host's file, the same in any quality.
  const songs = Object.keys(index.tracks).filter((id) => !id.startsWith('podcast:'))
  if (downloadsAvailable) {
    const cache = await caches.open(CACHE_NAME)
    for (const id of songs) await cache.delete(requestFor(id)).catch(() => undefined)
  }
  for (const id of songs) delete index.tracks[id]
  await reconcile()
}

/** Downloads a collection (or updates what it holds). */
export function downloadCollection(key: string, name: string, ids: string[], urls?: Record<string, string>) {
  index.collections[key] = { name, ids: [...new Set(ids)], urls, added: index.collections[key]?.added ?? Date.now() }
  void reconcile()
}

/** Removes a collection's download (its songs stay while another download holds them). */
export function removeDownload(key: string) {
  delete index.collections[key]
  void reconcile()
}

/** Keeps a downloaded collection in step with its source (songs added or removed since). */
export function syncDownload(key: string, ids: string[]) {
  const collection = index.collections[key]
  if (!collection) return
  const next = [...new Set(ids)]
  if (next.length === collection.ids.length && next.every((id, position) => collection.ids[position] === id)) return
  downloadCollection(key, collection.name, next, collection.urls)
}

/** Removes every download (the settings' button). */
export async function clearDownloads() {
  index = { quality: index.quality, tracks: {}, collections: {} }
  pending = []
  if (downloadsAvailable) await caches.delete(CACHE_NAME).catch(() => undefined)
  changed()
}

export const isDownloaded = (id: string | null | undefined) => !!id && !!index.tracks[id]

/** The object URL handed to the audio element last; released when the next one is made. */
let lastUrl: string | null = null

/** A playable address for a downloaded song, or null when it isn't downloaded. */
export async function downloadedAudioUrl(id: string | null | undefined): Promise<string | null> {
  if (!id || !downloadsAvailable || !index.tracks[id]) return null
  try {
    const response = await (await caches.open(CACHE_NAME)).match(requestFor(id))
    if (!response) {
      delete index.tracks[id]
      changed()
      void reconcile()
      return null
    }
    if (lastUrl) URL.revokeObjectURL(lastUrl)
    lastUrl = URL.createObjectURL(await response.blob())
    return lastUrl
  } catch {
    return null
  }
}

/** Whether a song is downloaded (re-renders when that changes). */
export function useIsDownloaded(id: string | null | undefined) {
  return useSyncExternalStore(subscribe, () => isDownloaded(id))
}

export type DownloadState = { saved: false } | { saved: true; done: number; total: number }

/** Whether a collection is downloaded, and how far. */
export function useDownloadState(key: string): DownloadState {
  useSyncExternalStore(subscribe, () => version)
  const collection = index.collections[key]
  if (!collection) return { saved: false }
  return { saved: true, done: collection.ids.filter((id) => index.tracks[id]).length, total: collection.ids.length }
}

/** How much is downloaded, and what is still to come. */
export function useDownloadStats() {
  useSyncExternalStore(subscribe, () => version)
  const files = Object.values(index.tracks)
  return {
    count: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    pending: pending.length,
    collections: Object.keys(index.collections).length,
    quality: index.quality,
  }
}
