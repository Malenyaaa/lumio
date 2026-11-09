import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { useLumioFetch } from '@/features/social/social'

/** Someone's year in listening, as the Lumio server sums it up (server/src/wrapped.ts). */
export interface WrappedTrack {
  /** The library's song id, else the imported service's (`spotify:…`). */
  key: string
  title: string
  artist: string | null
  album: string | null
  /** The album's id in the library. */
  contextId: string | null
  minutes: number
  plays: number
}

export interface Wrapped {
  year: number
  minutes: number
  plays: number
  tracks: number
  artists: number
  previousMinutes: number | null
  /** `peakMonth`: the month each was heard most in (0 = January). */
  topArtists: Array<{ name: string; minutes: number; plays: number; peakMonth: number }>
  topTracks: WrappedTrack[]
  playlistKeys: string[]
  /** `key` is the album's id in the library, or `name:…` for an album only known by name. */
  topAlbums: Array<{ key: string; name: string | null; artist: string | null; sampleKey: string; minutes: number }>
  topPodcasts: Array<{ name: string; minutes: number }>
  months: number[]
  hours: number[]
  /** Monday first. */
  weekdays: number[]
  topDay: { date: string; minutes: number } | null
  firstTrack: (WrappedTrack & { at: number }) | null
  onRepeat: (WrappedTrack & { date: string }) | null
  newArtists: { count: number; top: { name: string; minutes: number } | null }
  sources: Record<string, number>
  /** Minutes on each day of the year (1 January first). */
  daily: number[]
  activeDays: number
  /** The longest run of days in a row with music ("YYYY-MM-DD"). */
  streak: { days: number; from: string; to: string } | null
  /** The share of the time between midnight and 4 in the morning (0..1). */
  lateNight: number
  /** The share of streams that were songs heard in an earlier year (0..1). */
  repeatShare: number
  /** The song come back to on the most different days. */
  comfort: (WrappedTrack & { days: number }) | null
}

/** The month and day Wrapped of the running year comes out (as on the server). */
export const WRAPPED_RELEASE = { month: 11, day: 12 }

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The years with a Wrapped ready, newest first. */
export function useWrappedYears() {
  const { session } = useAuthedSession()
  const request = useLumioFetch()
  return useQuery({
    queryKey: ['wrapped', session.userId, 'years'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const response = await request(`/me/wrapped?tz=${encodeURIComponent(timeZone())}`)
      if (!response.ok) throw new Error('Lumio server unavailable')
      return ((await response.json()) as { years: number[] }).years
    },
  })
}

/** A year's Wrapped; null when nothing was played then. */
export function useWrapped(year: number) {
  const { session } = useAuthedSession()
  const request = useLumioFetch()
  return useQuery({
    queryKey: ['wrapped', session.userId, year],
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const response = await request(`/me/wrapped/${year}?tz=${encodeURIComponent(timeZone())}`)
      if (response.status === 404 || response.status === 403) return null
      if (!response.ok) throw new Error('Lumio server unavailable')
      return (await response.json()) as Wrapped
    },
  })
}

/**
 * A cover from Spotify for a song imported from there that the library doesn't have (Spotify's public oEmbed, which
 * needs no account). Only for the extended history's songs (they carry Spotify's id).
 */
export function useSpotifyCover(key: string | null | undefined) {
  const id = key?.match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1]
  return useQuery({
    queryKey: ['spotify-cover', id],
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`)
      if (!response.ok) return null
      return ((await response.json()) as { thumbnail_url?: string }).thumbnail_url ?? null
    },
  }).data ?? undefined
}

/** Whether a library id (not an imported service's key, nor an album known only by name). */
export const inLibrary = (key: string | null | undefined): key is string => !!key && !key.startsWith('spotify:') && !key.startsWith('name:')
