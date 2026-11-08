import type { Api } from '@jellyfin/sdk'
import type { BaseItemDto, MediaStream } from '@jellyfin/sdk/lib/generated-client/models'
import { useSyncExternalStore } from 'react'
import { jellyfin } from '@/lib/jellyfin'

/**
 * Episodes kept in the browser ahead of watching. Unlike songs, films and episodes are rarely watched twice, so the
 * approach differs: while a series plays, its next episodes are downloaded (as one MP4 each, at a bitrate set in the
 * settings, with their text subtitles), they then start instantly and play offline, and once watched to the end they
 * are deleted again. Anything older than a week goes too, as does whatever doesn't fit the space allowed.
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

function summarize() {
  const entries = Object.values(index)
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
}

/**
 * Downloads an episode (video, audio and text subtitles) unless it's stored already. The server converts it to an
 * MP4 the browser plays as a file (H.264 and AAC, copied as they are where the source already is). Saved as it
 * arrives, so a long download never sits in memory whole.
 */
export function downloadVideo(api: Api, session: { userId: string; accessToken: string }, item: BaseItemDto, settings: VideoCacheSettings): Promise<void> {
  const itemId = item.Id
  if (!videoCacheAvailable || !itemId || index[itemId]) return Promise.resolve()
  const running = inFlight.get(itemId)
  if (running) return running
  const job = (async () => {
    try {
      const source = item.MediaSources?.[0]
      const streams = (source?.MediaStreams ?? item.MediaStreams ?? []).filter((stream) => stream.Type === 'Audio' || stream.Type === 'Subtitle' || stream.Type === 'Video')
      const audioIndex = source?.DefaultAudioStreamIndex ?? streams.find((stream) => stream.Type === 'Audio')?.Index ?? undefined
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
        api_key: session.accessToken,
      })
      const response = await fetch(`${api.basePath}/Videos/${itemId}/stream.mp4?${params}`, { priority: 'low' } as RequestInit)
      if (!response.ok || !response.body) return
      // Counted on the way into the cache.
      let bytes = 0
      const counted = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength
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
        const url = `${api.basePath}/Videos/${itemId}/${source?.Id ?? itemId}/Subtitles/${stream.Index}/0/Stream.vtt?api_key=${session.accessToken}`
        const vtt = await fetch(url).catch(() => null)
        if (!vtt?.ok) continue
        const blob = await vtt.blob()
        bytes += blob.size
        await cache.put(subtitleKey(itemId, stream.Index), new Response(blob, { headers: { 'Content-Type': 'text/vtt' } }))
        subtitles.push({ index: stream.Index, language: stream.Language ?? undefined, title: stream.DisplayTitle ?? undefined })
      }

      index[itemId] = { bytes, added: Date.now(), name: item.Name ?? '', audioIndex: audioIndex ?? undefined, subtitles, streams }
      saveIndex()
      await trimVideos(settings.maxBytes, itemId)
    } catch {
      // Offline, storage full or refused: the episode streams as usual.
      await caches
        .open(CACHE_NAME)
        .then((cache) => cache.delete(fileKey(itemId)))
        .catch(() => undefined)
    } finally {
      inFlight.delete(itemId)
    }
  })()
  inFlight.set(itemId, job)
  return job
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

/** Drops copies older than a week, then the oldest until everything fits (`keep` stays). */
export async function trimVideos(maxBytes: number, keep?: string) {
  if (!videoCacheAvailable) return
  for (const [itemId, entry] of Object.entries(index)) if (Date.now() - entry.added > MAX_AGE_MS && itemId !== keep) await forgetVideo(itemId)
  let total = summarize().bytes
  for (const [itemId, entry] of Object.entries(index).sort((a, b) => a[1].added - b[1].added)) {
    if (total <= maxBytes) break
    if (itemId === keep) continue
    await forgetVideo(itemId)
    total -= entry.bytes
  }
}

export async function clearVideoCache() {
  if (videoCacheAvailable) await caches.delete(CACHE_NAME).catch(() => undefined)
  index = {}
  saveIndex()
}
