import type { Api } from '@jellyfin/sdk'
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useSyncExternalStore } from 'react'
import { getMediaSegmentApi } from '@jellyfin/sdk/lib/utils/api/media-segment-api'
import { forgetSegments, hasSegments, offlineItem, rememberItems, rememberSegments } from '@/features/listen/offline-library'
import { backdropImageUrl, landscapeImageUrl, portraitImageUrl } from '@/lib/images'
import { remindPersistentStorage } from '@/lib/persistent-storage'
import { downloadVideo, forgetVideo, isVideoPinned, pinnedVideoIds, pinVideo, videoBytes, videoCacheAvailable } from './video-cache'

/**
 * Downloads for Watch: films, whole seasons and single episodes, kept on this device for good (unlike the episodes the
 * player stores ahead, see video-cache, whose files they share, pinned). Each is one MP4 with its text subtitles: the
 * original file when the browser plays it as it is (fast, as the network allows), else converted by the server in the
 * download quality (about as fast as it plays). A downloaded season stays in step with the server: episodes added later are fetched too (except
 * those taken out by hand). What the pages need offline (the items, the season's other episodes, the pictures) is
 * kept beside them, so the series page and the player's episode list show the downloads and grey out the rest.
 *
 * The index (what was downloaded, by key) sits in localStorage; the files in video-cache's Cache Storage.
 */
const INDEX_KEY = 'lumio.videoDownloads.v1'

export type VideoDownloadKind = 'movie' | 'season' | 'episode'

interface Collection {
  kind: VideoDownloadKind
  name: string
  /** The films or episodes it holds. */
  ids: string[]
  /** A season's episodes taken out by hand: not fetched again when the season is brought up to date. */
  excluded?: string[]
  seriesId?: string
  added: number
}

let index: Record<string, Collection> = (() => {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}') as Record<string, Collection>
  } catch {
    return {}
  }
})()

interface Source {
  api: Api
  session: { userId: string; accessToken: string }
  /** Download bitrate in bit/s; null for the original quality. */
  bitrate: number | null
}

let source: Source | null = null
let pending: string[] = []
/** The file coming in now and how far (bytes so far, and about how many there will be). */
let current: { id: string; received: number; expected: number } | null = null
let running = false
/** Stops the file coming in now (its download was removed meanwhile). */
let abortCurrent: AbortController | null = null
/** Why the last try of a file failed (shown while it waits for the next one): a short kind and the browser's text. */
const failures: Record<string, { kind: FailureKind; detail: string }> = {}

export type FailureKind = 'network' | 'storage' | 'server' | 'other'

function failureOf(error: unknown): { kind: FailureKind; detail: string } {
  const detail = error instanceof Error ? error.message : String(error)
  if (/^HTTP \d+/.test(detail)) return { kind: 'server', detail }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return { kind: 'storage', detail }
  // Fetch failing (offline, the connection dropped) or the stream into the cache breaking off (Firefox: NS_ERROR_FAILURE).
  if (error instanceof TypeError || /NS_ERROR|network|abort/i.test(detail)) return { kind: 'network', detail }
  return { kind: 'other', detail }
}
let version = 0
const listeners = new Set<() => void>()

function notify() {
  version++
  for (const listener of listeners) listener()
}

function changed() {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // Kept for this visit only.
  }
  notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const wanted = () => new Set(Object.values(index).flatMap((collection) => collection.ids))

/** Lines up what is wanted but not stored yet, and deletes files no download holds any more (freeing their space). */
function reconcile() {
  const want = wanted()
  pending = [...want].filter((id) => !isVideoPinned(id))
  for (const id of pinnedVideoIds()) if (!want.has(id)) void forgetVideo(id)
  void forgetSegments(want)
  // Removed while it comes in: stopped at once (the server stops converting it too).
  if (current && !want.has(current.id)) abortCurrent?.abort()
  changed()
  void run()
}

/** For the original quality when a file's bitrate isn't known: high enough that nothing is lost. */
const ORIGINAL_BITRATE_UNKNOWN = 40_000_000

/** The bytes a file will about have: its length at the download bitrate (the server says no size for a conversion). */
const expectedBytes = (item: BaseItemDto, bitrate: number) => ((item.RunTimeTicks ?? 0) / 10_000_000) * ((bitrate + 192_000) / 8)

/** Loads the pictures the pages show for it through the service worker, which keeps them for offline use. */
function warmImages(api: Api, items: BaseItemDto[]) {
  for (const item of items) {
    const urls =
      item.Type === 'Episode'
        ? [landscapeImageUrl(api, item, { fillWidth: 320 })]
        : [portraitImageUrl(api, item, { fillHeight: 600 }), portraitImageUrl(api, item, { fillHeight: 300 }), backdropImageUrl(api, item)]
    for (const url of urls) if (url) new Image().src = url
  }
}

/** Downloads the pending files one after another; stops when offline and goes on once back. */
async function run() {
  if (running || !source || !videoCacheAvailable) return
  running = true
  try {
    while (pending.length && source) {
      const id = pending[0]!
      const { api, session, bitrate } = source
      try {
        const item = (await getLibraryApi(api).getItem({ itemId: id, userId: session.userId })).data
        if (!wanted().has(id)) throw new Error('Removed')
        // Original quality: a file the browser can't play as it is is converted at its own bitrate, so the server only
        // repackages what it can (H.264 in MKV) and keeps the rest as good as it is.
        const rate = bitrate ?? (item.MediaSources?.[0]?.Bitrate || ORIGINAL_BITRATE_UNKNOWN)
        current = { id, received: 0, expected: expectedBytes(item, rate) }
        notify()
        let shown = 0
        abortCurrent = new AbortController()
        await downloadVideo(api, session, item, {
          maxBytes: Infinity,
          bitrate: rate,
          pinned: true,
          original: true,
          originalQuality: bitrate === null,
          signal: abortCurrent.signal,
          onProgress: (bytes, total) => {
            if (!current || current.id !== id) return
            current.received = bytes
            if (total) current.expected = total
            if (Date.now() - shown > 500) {
              shown = Date.now()
              notify()
            }
          },
        })
        // Its intro, recap and credits (Intro Skipper), so skipping works offline too.
        const found = await getMediaSegmentApi(api).getItemSegments({ itemId: id }).catch(() => null)
        if (found) rememberSegments(id, found.data)
        // Removed meanwhile: deleted again. Stored by the player's prefetch at the same time: pinned now.
        if (!wanted().has(id)) void forgetVideo(id)
        else if (!isVideoPinned(id)) {
          pinVideo(id, true)
          if (!isVideoPinned(id)) throw new Error('Not stored')
        }
        pending = pending.filter((entry) => entry !== id)
        delete failures[id]
        current = null
        changed()
      } catch (error) {
        current = null
        pending = pending.filter((entry) => entry !== id)
        // Removed meanwhile: nothing to try again.
        if (!wanted().has(id)) continue
        failures[id] = failureOf(error)
        // Offline or the server failed: tried again when the connection is back, or in a moment.
        pending.push(id)
        notify()
        if (!navigator.onLine) break
        await new Promise((resolve) => setTimeout(resolve, 10_000))
      }
    }
  } finally {
    running = false
    current = null
    abortCurrent = null
    notify()
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => void run())

/** Set while signed in (see VideoDownloadsHost): where downloads come from, in which quality. Starts what is pending. */
export function setVideoDownloadSource(next: Source | null) {
  source = next
  if (!next) return
  reconcile()
  void fetchMissingSegments(next)
}

/** Downloads from before segments were kept get theirs now. */
async function fetchMissingSegments({ api }: Source) {
  for (const id of wanted()) {
    if (!isVideoPinned(id) || (await hasSegments(id))) continue
    const found = await getMediaSegmentApi(api).getItemSegments({ itemId: id }).catch(() => null)
    if (found) rememberSegments(id, found.data)
  }
}

/**
 * Downloads a film, a season or an episode. `items`: what it holds (the film, the season's episodes); `context`: what
 * the pages need besides offline (the series, its seasons, the other episodes of the season).
 */
export function downloadVideos(key: string, kind: VideoDownloadKind, name: string, items: BaseItemDto[], context: BaseItemDto[] = []) {
  if (!videoCacheAvailable || !items.length) return
  // Without persistent storage the browser may delete downloads again: said once more when starting one.
  if (!index[key]) remindPersistentStorage()
  index[key] = { kind, name, ids: items.map((item) => item.Id!), seriesId: items[0]?.SeriesId ?? undefined, added: index[key]?.added ?? Date.now() }
  rememberItems([...items, ...context])
  if (source) warmImages(source.api, [...items, ...context.filter((item) => item.Type === 'Series' || item.Type === 'Movie')])
  reconcile()
}

/** Removes a download (its files stay while another download holds them, and are deleted otherwise). */
export function removeVideoDownload(key: string) {
  delete index[key]
  reconcile()
}

/** Takes one episode out of whatever holds it (a season stays downloaded without it). */
export function removeEpisodeDownload(episodeId: string) {
  for (const [key, collection] of Object.entries(index)) {
    if (!collection.ids.includes(episodeId)) continue
    if (collection.kind === 'season') {
      const ids = collection.ids.filter((id) => id !== episodeId)
      if (ids.length) index[key] = { ...collection, ids, excluded: [...(collection.excluded ?? []), episodeId] }
      else delete index[key]
    } else delete index[key]
  }
  reconcile()
}

/** Keeps a downloaded season in step with the server: new episodes are fetched (not those taken out by hand). */
export function syncSeasonDownload(seasonId: string, episodes: BaseItemDto[]) {
  const key = `season:${seasonId}`
  const collection = index[key]
  if (!collection) return
  const excluded = new Set(collection.excluded ?? [])
  const added = episodes.filter((episode) => episode.Id && !collection.ids.includes(episode.Id) && !excluded.has(episode.Id))
  // The season's list is kept as it is now in any case (for the greyed-out rest offline).
  rememberItems(episodes)
  if (!added.length) return
  index[key] = { ...collection, ids: [...collection.ids, ...added.map((episode) => episode.Id!)] }
  reconcile()
}

/** Removes every video download (the settings' button). */
export function clearVideoDownloads() {
  index = {}
  reconcile()
}

/** The ids of downloaded films and episodes (for the offline library). */
export const downloadedVideoIds = () => wanted()

/** `error`: why the last try failed (it is tried again). */
export type VideoDownloadState =
  | { state: 'done' }
  | { state: 'loading'; share: number }
  | { state: 'queued'; error?: { kind: FailureKind; detail: string } }
  | null

const shareOf = (entry: NonNullable<typeof current>) => (entry.expected ? Math.min(0.99, entry.received / entry.expected) : 0)

function stateOf(id: string): VideoDownloadState {
  if (!wanted().has(id)) return null
  if (isVideoPinned(id)) return { state: 'done' }
  if (current?.id === id) return { state: 'loading', share: shareOf(current) }
  return { state: 'queued', error: failures[id] }
}

/** A film's or episode's download: there, coming in now (how far, 0–1), waiting its turn, or none. */
export function useVideoDownload(id: string | null | undefined): VideoDownloadState {
  useSyncExternalStore(subscribe, () => version)
  return id ? stateOf(id) : null
}

/** Whether a season is downloaded, and how far. */
export function useSeasonDownload(seasonId: string | null | undefined) {
  useSyncExternalStore(subscribe, () => version)
  const collection = seasonId ? index[`season:${seasonId}`] : undefined
  if (!collection) return null
  const done = collection.ids.filter((id) => isVideoPinned(id)).length
  const share = current && collection.ids.includes(current.id) ? shareOf(current) : 0
  return { done, total: collection.ids.length, share: collection.ids.length ? (done + share) / collection.ids.length : 0 }
}

export interface DownloadedVideo {
  id: string
  item?: BaseItemDto
  state: NonNullable<VideoDownloadState>
  bytes: number
  /** The keys of the downloads holding it (a season, the episode on its own). */
  keys: string[]
  added: number
}

/** Everything downloaded, with its item (kept for offline use), state and size, newest first. */
export function useDownloadedVideos(): DownloadedVideo[] {
  useSyncExternalStore(subscribe, () => version)
  const byId = new Map<string, DownloadedVideo>()
  for (const [key, collection] of Object.entries(index)) {
    for (const id of collection.ids) {
      const entry = byId.get(id) ?? { id, item: offlineItem(id), state: stateOf(id)!, bytes: videoBytes(id), keys: [], added: collection.added }
      entry.keys.push(key)
      byId.set(id, entry)
    }
  }
  return [...byId.values()].sort((a, b) => b.added - a.added)
}

/** How much is downloaded, and what is still to come. */
export function useVideoDownloadStats() {
  useSyncExternalStore(subscribe, () => version)
  const ids = [...wanted()]
  const done = ids.filter((id) => isVideoPinned(id))
  return { count: done.length, bytes: done.reduce((sum, id) => sum + videoBytes(id), 0), pending: ids.length - done.length }
}
