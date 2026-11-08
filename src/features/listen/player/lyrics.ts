import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLyricApi } from '@jellyfin/sdk/lib/utils/api/lyric-api'
import type { Api } from '@jellyfin/sdk'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { externalOf } from '@/lib/external-items'
import { ticksToSeconds } from '@/lib/format'
import { relayFetch } from '@/features/social/social'

export interface LyricLine {
  /** Seconds into the track; missing for plain (unsynced) lyrics. */
  time?: number
  text: string
}

export interface Lyrics {
  lines: LyricLine[]
  synced: boolean
  source: 'jellyfin' | 'lrclib'
}

/** "[01:23.45] text" lines of an LRC file; lines without a timestamp are skipped when any line has one. */
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const stamp of stamps) lines.push({ time: Number(stamp[1]) * 60 + Number(stamp[2]), text })
  }
  return lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
}

/**
 * A track's lyrics: from Jellyfin first (embedded or .lrc files, or fetched by a lyrics plugin), otherwise from
 * lrclib.net, a free lyrics database that needs no key. Synced lyrics carry a time per line.
 */
export function useLyrics(item: BaseItemDto | undefined) {
  const { api } = useAuthedSession()
  return useQuery(lyricsOptions(api, item))
}

/** The lyrics query, also for loading them ahead (the next track's). */
export function lyricsOptions(api: Api, item: BaseItemDto | undefined) {
  return queryOptions({
    queryKey: ['lyrics', item?.Id],
    // Podcasts have no lyrics.
    enabled: !!item?.Id && !externalOf(item),
    // Lyrics don't change: kept (also across restarts, see query-persist) as long as the saved data is.
    staleTime: Infinity,
    gcTime: 30 * 24 * 60 * 60_000,
    retry: false,
    queryFn: async (): Promise<Lyrics | null> => {
      try {
        const { data } = await getLyricApi(api).getLyrics({ itemId: item!.Id! })
        const lines = (data.Lyrics ?? []).map((line) => ({
          time: line.Start != null ? ticksToSeconds(line.Start) : undefined,
          text: line.Text ?? '',
        }))
        if (lines.length) return { lines, synced: lines.some((line) => line.time !== undefined), source: 'jellyfin' }
      } catch {
        // No lyrics in Jellyfin (404); try lrclib.
      }
      const params = new URLSearchParams({
        track_name: item!.Name ?? '',
        artist_name: item!.AlbumArtist ?? item!.Artists?.[0] ?? '',
        album_name: item!.Album ?? '',
        duration: String(Math.round(ticksToSeconds(item!.RunTimeTicks ?? 0))),
      })
      // Through the Lumio server, which keeps them for everyone.
      const response = await relayFetch('lyrics', 'api/get', params, 'https://lrclib.net/')
      if (!response.ok) return null
      const found = (await response.json()) as { syncedLyrics?: string | null; plainLyrics?: string | null; instrumental?: boolean }
      if (found.syncedLyrics) return { lines: parseLrc(found.syncedLyrics), synced: true, source: 'lrclib' }
      if (found.plainLyrics) return { lines: found.plainLyrics.split(/\r?\n/).map((text) => ({ text })), synced: false, source: 'lrclib' }
      return null
    },
  })
}
