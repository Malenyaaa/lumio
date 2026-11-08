import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getArtistApi } from '@jellyfin/sdk/lib/utils/api/artist-api'
import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { relayFetch } from '@/features/social/social'
import { externalOf } from '@/lib/external-items'
import { ticksToSeconds } from '@/lib/format'
import { artistsOf } from '@/lib/item-links'
import { sameName } from './external'

const HALF_YEAR = 180 * 24 * 60 * 60_000

export interface CreditedArtist {
  name: string
  /** The artist in this library, when there is one. */
  id?: string
}

/** A recording's credits on MusicBrainz: everyone on it, who wrote and produced it, and who published it. */
export interface RecordingCredits {
  artists: CreditedArtist[]
  writers: string[]
  composers: string[]
  lyricists: string[]
  producers: string[]
  mixers: string[]
  engineers: string[]
  publishers: string[]
  labels: string[]
  isrc?: string
}

interface Relation {
  type: string
  artist?: { name: string }
  label?: { name: string }
  work?: { relations?: Relation[] }
}

const musicbrainz = async <T>(path: string, query: Record<string, string>): Promise<T | null> => {
  const response = await relayFetch('musicbrainz', path, new URLSearchParams({ ...query, fmt: 'json' }), 'https://musicbrainz.org/ws/2/')
  return response.ok ? ((await response.json()) as T) : null
}

/**
 * A track's full credits from MusicBrainz (through the Lumio server, kept half a year): Jellyfin knows only what the
 * file's tags say, which often leaves out featured artists, and never knows writers or labels. The recording is the
 * one with the same title and artist, closest in length.
 */
export function useRecordingCredits(track: BaseItemDto | undefined) {
  const { api, session } = useAuthedSession()
  const artist = track ? artistsOf(track)[0]?.name : undefined
  const title = track?.Name ?? undefined
  return useQuery({
    queryKey: ['recording-credits', 2, title, artist, track?.Album],
    enabled: !!title && !!artist && !!track && !externalOf(track),
    // Found credits are kept; a miss is asked again after a day.
    staleTime: (query) => (query.state.data === null ? 24 * 60 * 60_000 : HALF_YEAR),
    gcTime: HALF_YEAR,
    retry: false,
    queryFn: async (): Promise<RecordingCredits | null> => {
      const quote = (value: string) => `"${value.replace(/["\\]/g, ' ')}"`
      // "Song (feat. Someone)": MusicBrainz names the song without the guests (they are in its artist credit).
      const bare = title!.replace(/\s*[([](feat|ft|with)\.?\s[^)\]]*[)\]]/gi, '').trim() || title!
      const found = await musicbrainz<{ recordings?: Array<{ id: string; score: number; title: string; length?: number; 'artist-credit'?: Array<{ name: string }> }> }>(
        'recording',
        { query: `recording:${quote(bare)} AND artist:${quote(artist!)}`, limit: '10' },
      )
      const seconds = track?.RunTimeTicks ? ticksToSeconds(track.RunTimeTicks) : undefined
      const candidates = (found?.recordings ?? []).filter(
        (recording) => recording.score >= 90 && sameName(recording.title, title) && recording['artist-credit']?.some((credit) => sameName(credit.name, artist)),
      )
      const off = (length?: number) => (seconds && length ? Math.abs(length / 1000 - seconds) : 30)
      const best = candidates.sort((a, b) => off(a.length) - off(b.length))[0]
      if (!best || off(best.length) > 15) return null

      const recording = await musicbrainz<{
        'artist-credit'?: Array<{ name: string; artist?: { name: string } }>
        relations?: Relation[]
        releases?: Array<{ id: string; title: string; status?: string }>
        isrcs?: string[]
      }>(`recording/${best.id}`, { inc: 'artist-credits+artist-rels+label-rels+work-rels+work-level-rels+releases+isrcs' })
      if (!recording) return null

      const credits: RecordingCredits = { artists: [], writers: [], composers: [], lyricists: [], producers: [], mixers: [], engineers: [], publishers: [], labels: [], isrc: recording.isrcs?.[0] }
      const add = (list: string[], name?: string) => name && !list.includes(name) && list.push(name)
      const read = (relations: Relation[] = []) => {
        for (const relation of relations) {
          const name = relation.artist?.name
          if (relation.type === 'writer') add(credits.writers, name)
          else if (relation.type === 'composer') add(credits.composers, name)
          else if (relation.type === 'lyricist') add(credits.lyricists, name)
          else if (relation.type === 'producer') add(credits.producers, name)
          else if (relation.type === 'mix') add(credits.mixers, name)
          else if (relation.type === 'engineer' || relation.type === 'mastering' || relation.type === 'recording') add(credits.engineers, name)
          else if (relation.type === 'publishing') add(credits.publishers, relation.label?.name)
          if (relation.work) read(relation.work.relations)
        }
      }
      read(recording.relations)

      // The label: from the release this track is on (the album of that name), else its first official one.
      const releases = recording.releases ?? []
      const release = releases.find((entry) => sameName(entry.title, track?.Album)) ?? releases.find((entry) => entry.status === 'Official') ?? releases[0]
      if (release) {
        const details = await musicbrainz<{ 'label-info'?: Array<{ label?: { name: string } }> }>(`release/${release.id}`, { inc: 'labels' }).catch(() => null)
        for (const info of details?.['label-info'] ?? []) if (info.label?.name !== '[no label]') add(credits.labels, info.label?.name)
      }

      // Everyone on the recording, each linked to the library's artist where there is one.
      const names = (recording['artist-credit'] ?? []).map((credit) => credit.artist?.name ?? credit.name)
      credits.artists = await Promise.all(
        names.map(async (name) => {
          const known = track && artistsOf(track).find((entry) => sameName(entry.name, name))
          if (known) return { name: known.name, id: known.id }
          const item = await getArtistApi(api)
            .getArtistByName({ name, userId: session.userId })
            .then((response) => response.data)
            .catch(() => null)
          return { name: item?.Name ?? name, id: item?.Id ?? undefined }
        }),
      )
      return credits
    },
  })
}

/** A track's artists: Jellyfin's, plus whoever else MusicBrainz names on the recording (featured artists). */
export function useTrackArtists(track: BaseItemDto | undefined): CreditedArtist[] {
  const credits = useRecordingCredits(track).data
  const own = track ? artistsOf(track) : []
  const extra = (credits?.artists ?? []).filter((artist) => !own.some((entry) => sameName(entry.name, artist.name)))
  return [...own, ...extra]
}
