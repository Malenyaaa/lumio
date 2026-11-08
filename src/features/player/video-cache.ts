import type { Api } from '@jellyfin/sdk'
import type { BaseItemDto, MediaStream } from '@jellyfin/sdk/lib/generated-client/models'
import { useSyncExternalStore } from 'react'
import { jellyfin } from '@/lib/jellyfin'

/**
 * Episodes kept in the browser ahead of watching. Unlike songs, films and episodes are rarely watched twice, so the
 * approach differs: while a series plays, its next episodes are downloaded (as one MP4 each, at a bitrate set in the
 * settings, with their text subtitles), they then start instantly and play offline, and once watched to the end they
 * are deleted again. Anything older than a week goes too, as does whatever doesn't fit the space allowed.
 * Downloads (see video-downloads) keep their files here too, pinned: never trimmed, expired or deleted when watched.
 */
const CACHE_NAME = 'lumio-video-v1'
const INDEX_KEY = 'lumio.videoCache.index'
const MAX_AGE_MS = 7 * 24 * 60 * 60_000

export const videoCacheAvailable = typeof window !== 'undefined' && 'caches' in window

export interface CachedSubtitle {
  index: number
  language?: string
  title?: string
}

interface Entry {
  bytes: number
  added: number
  name: string
  /** The audio track in the file (the item's default) and the subtitles stored next to it. */
  audioIndex?: number
  subtitles: CachedSubtitle[]
  /** What the item's streams looked like, for the player's track menus. */
  streams: MediaStream[]
  /** Held by a download: stays until the download is removed. */
  pinned?: boolean
  /** The quality it was stored in: a bitrate (bit/s), or null for the original file (unset in older copies). */
  bitrate?: number | null
}

type Index = Record<string, Entry>

let index: Index = (() => {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}') as Index
  } catch {
    return {}
  }
})()
let stats = summarize()
const listeners = new Set<() => void>()
const inFlight = new Map<string, Promise<void>>()

/** The cache's part (downloads are counted on their own). */
function summarize() {
  const entries = Object.values(index).filter((entry) => !entry.pinned)
  return { count: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) }
}

function saveIndex() {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    // Kept in memory for this visit.
  }
  stats = summarize()
  for (const listener of listeners) listener()
}

const fileKey = (itemId: string) => new Request(`https://lumio.cache/video/${itemId}`)
const subtitleKey = (itemId: string, subtitle: number) => new Request(`https://lumio.cache/video/${itemId}/subtitle/${subtitle}`)

export function useVideoCacheStats() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => stats,
  )
}

export const isVideoCached = (itemId: string) => !!index[itemId]
export const isVideoPinned = (itemId: string) => !!index[itemId]?.pinned
export const pinnedVideoIds = () => Object.keys(index).filter((itemId) => index[itemId]!.pinned)
/** The quality a stored copy is in: a bitrate, null for the original file, undefined when unknown or not stored. */
export const storedQuality = (itemId: string) => index[itemId]?.bitrate

/** A stored file's size (0 when there is none). */
export const videoBytes = (itemId: string) => index[itemId]?.bytes ?? 0

/** Pins a stored file for a download, or hands it back to the cache (`false`, the download was removed). */
export function pinVideo(itemId: string, pinned: boolean) {
  const entry = index[itemId]
  if (!entry || !!entry.pinned === pinned) return
  // Back in the cache it counts as new, so it isn't the first to go.
  index[itemId] = { ...entry, pinned: pinned || undefined, added: pinned ? entry.added : Date.now() }
  saveIndex()
}

/** Whether an item has a stored file (re-renders when that changes). */
export function useVideoStored(itemId: string | null | undefined) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => !!itemId && !!index[itemId],
  )
}

/** What the player needs to play a stored copy: the file, the subtitles as object URLs, and the item's streams. */
export async function cachedVideo(itemId: string) {
  const entry = index[itemId]
  if (!videoCacheAvailable || !entry) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const file = await cache.match(fileKey(itemId))
    if (!file) {
      await forgetVideo(itemId)
      return null
    }
    const subtitleUrls: Record<number, string> = {}
    for (const subtitle of entry.subtitles) {
      const response = await cache.match(subtitleKey(itemId, subtitle.index))
      if (response) subtitleUrls[subtitle.index] = URL.createObjectURL(await response.blob())
    }
    return { url: URL.createObjectURL(await file.blob()), subtitleUrls, audioIndex: entry.audioIndex, streams: entry.streams }
  } catch {
    return null
  }
}

export interface VideoCacheSettings {
  maxBytes: number
  /** Download bitrate in bit/s. */
  bitrate: number
  /** For a download: kept for good (and not counted against the cache's space). */
  pinned?: boolean
  /** A file the browser plays as it is (MP4 with H.264 and AAC or MP3) is downloaded unchanged, in its original quality. */
  original?: boolean
  /** Converted in the original quality (at the file's own bitrate): noted as the original, not as a bitrate. */
  originalQuality?: boolean
  /** Told the bytes received so far while it downloads (and how many there will be, when the server says). */
  onProgress?: (bytes: number, total?: number) => void
  /** Stops the download (a download removed while it comes in). */
  signal?: AbortSignal
}

/**
 * Downloads an episode (video, audio and text subtitles) unless it's stored already. The server converts it to an
 * MP4 the browser plays as a file (H.264 and AAC, copied as they are where the source already is). Saved as it
 * arrives, so a long download never sits in memory whole.
 */
export function downloadVideo(api: Api, session: { userId: string; accessToken: string }, item: BaseItemDto, settings: VideoCacheSettings): Promise<void> {
  const itemId = item.Id
  if (!videoCacheAvailable || !itemId) return Promise.resolve()
  // Stored ahead already: a download just keeps that copy.
  if (index[itemId]) {
    if (settings.pinned) pinVideo(itemId, true)
    return Promise.resolve()
  }
  const running = inFlight.get(itemId)
  if (running) return running
  const job = (async () => {
    try {
      const source = item.MediaSources?.[0]
      const streams = (source?.MediaStreams ?? item.MediaStreams ?? []).filter((stream) => stream.Type === 'Audio' || stream.Type === 'Subtitle' || stream.Type === 'Video')
      const asIs = settings.original && playsAsIs(source)
      // The original file plays its first audio track (browsers can't switch between the tracks of a file).
      const audioIndex = asIs
        ? (streams.find((stream) => stream.Type === 'Audio')?.Index ?? undefined)
        : (source?.DefaultAudioStreamIndex ?? streams.find((stream) => stream.Type === 'Audio')?.Index ?? undefined)
      const params = new URLSearchParams({
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        maxAudioChannels: '2',
        videoBitRate: String(settings.bitrate),
        audioBitRate: '192000',
        ...(audioIndex != null ? { audioStreamIndex: String(audioIndex) } : {}),
        subtitleMethod: 'External',
        mediaSourceId: source?.Id ?? itemId,
        deviceId: jellyfin.deviceInfo.id,
        playSessionId: crypto.randomUUID(),
        ApiKey: session.accessToken,
      })
      // Unchanged: the file itself, as fast as the network allows. Otherwise converted by the server, about as fast as
      // it plays.
      const url = asIs
        ? `${api.basePath}/Videos/${itemId}/stream?${new URLSearchParams({ static: 'true', mediaSourceId: source?.Id ?? itemId, ApiKey: session.accessToken })}`
        : `${api.basePath}/Videos/${itemId}/stream.mp4?${params}`
      const response = await fetch(url, { priority: 'low', signal: settings.signal } as RequestInit)
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      const total = Number(response.headers.get('content-length')) || undefined
      // Counted on the way into the cache.
      let bytes = 0
      const counted = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength
            settings.onProgress?.(bytes, total)
            controller.enqueue(chunk)
          },
        }),
      )
      const cache = await caches.open(CACHE_NAME)
      await cache.put(fileKey(itemId), new Response(counted, { headers: { 'Content-Type': 'video/mp4' } }))

      // Text subtitles as WebVTT files next to it (image-based ones can't be converted).
      const subtitles: CachedSubtitle[] = []
      for (const stream of streams) {
        if (stream.Type !== 'Subtitle' || stream.Index == null || !stream.IsTextSubtitleStream) continue
        const url = `${api.basePath}/Videos/${itemId}/${source?.Id ?? itemId}/Subtitles/${stream.Index}/0/Stream.vtt?ApiKey=${session.accessToken}`
        const vtt = await fetch(url).catch(() => null)
        if (!vtt?.ok) continue
        const blob = await vtt.blob()
        bytes += blob.size
        await cache.put(subtitleKey(itemId, stream.Index), new Response(blob, { headers: { 'Content-Type': 'text/vtt' } }))
        subtitles.push({ index: stream.Index, language: stream.Language ?? undefined, title: stream.DisplayTitle ?? undefined })
      }

      index[itemId] = { bytes, added: Date.now(), name: item.Name ?? '', audioIndex: audioIndex ?? undefined, subtitles, streams, pinned: settings.pinned || undefined, bitrate: asIs || settings.originalQuality ? null : settings.bitrate }
      saveIndex()
      if (!settings.pinned) await trimVideos(settings.maxBytes, itemId)
    } catch (error) {
      // Offline, storage full or refused: the episode streams as usual (a download tries again later).
      await caches
        .open(CACHE_NAME)
        .then((cache) => cache.delete(fileKey(itemId)))
        .catch(() => undefined)
      if (settings.pinned) throw error
    } finally {
      inFlight.delete(itemId)
    }
  })()
  inFlight.set(itemId, job)
  return job
}

/** Whether the browser plays a file as it is: MP4 with H.264 video and AAC or MP3 as its first audio track. */
function playsAsIs(source: NonNullable<BaseItemDto['MediaSources']>[number] | undefined) {
  if (!source) return false
  const containers = (source.Container ?? '').toLowerCase().split(',')
  if (!containers.includes('mp4') && !containers.includes('m4v')) return false
  const streams = source.MediaStreams ?? []
  const video = streams.find((stream) => stream.Type === 'Video')
  const audio = streams.find((stream) => stream.Type === 'Audio')
  return video?.Codec?.toLowerCase() === 'h264' && (!audio || ['aac', 'mp3'].includes(audio.Codec?.toLowerCase() ?? ''))
}

/** Deletes an episode's stored copy (watched to the end, or making room). */
export async function forgetVideo(itemId: string) {
  const entry = index[itemId]
  delete index[itemId]
  saveIndex()
  if (!videoCacheAvailable) return
  const cache = await caches.open(CACHE_NAME)
  await cache.delete(fileKey(itemId))
  for (const subtitle of entry?.subtitles ?? []) await cache.delete(subtitleKey(itemId, subtitle.index))
}

/** Drops copies older than a week, then the oldest until everything fits (`keep` stays; downloads always do). */
export async function trimVideos(maxBytes: number, keep?: string) {
  if (!videoCacheAvailable) return
  for (const [itemId, entry] of Object.entries(index)) if (!entry.pinned && Date.now() - entry.added > MAX_AGE_MS && itemId !== keep) await forgetVideo(itemId)
  let total = summarize().bytes
  for (const [itemId, entry] of Object.entries(index).filter(([, entry]) => !entry.pinned).sort((a, b) => a[1].added - b[1].added)) {
    if (total <= maxBytes) break
    if (itemId === keep) continue
    await forgetVideo(itemId)
    total -= entry.bytes
  }
}

/** Empties the cache; downloads stay. */
export async function clearVideoCache() {
  for (const [itemId, entry] of Object.entries(index)) if (!entry.pinned) await forgetVideo(itemId).catch(() => undefined)
}
