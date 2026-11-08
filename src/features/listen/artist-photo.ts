import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { lumioGet, relayedImage, relayFetch } from '@/features/social/social'
import { plainText } from '@/lib/format'
import { getLocale, useLocale } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { sameName, useLastfmArtist } from './external'

const MONTH = 30 * 24 * 60 * 60_000

/** An artist's photo from Deezer (through the Lumio server), when the name matches exactly; null when there is none. */
async function deezerPhoto(name: string): Promise<string | null> {
  const response = await relayFetch('deezer', 'search/artist', new URLSearchParams({ q: name, limit: '5' }), 'https://api.deezer.com/')
  if (!response.ok) return null
  const data = (await response.json()) as { data?: Array<{ name: string; picture_xl?: string; picture_big?: string }> }
  const match = data.data?.find((artist) => sameName(artist.name, name))
  const picture = match?.picture_xl ?? match?.picture_big
  // Deezer's stand-in for "no photo" has an empty image id.
  if (!picture || picture.includes('/artist//')) return null
  return relayedImage(picture) ?? null
}

interface EpidemicProfile {
  name: string
  description?: string
  image?: string
}

/** The artist's profile on Epidemic Sound (description, photo), for artists who publish there; null otherwise. */
export function useEpidemicProfile(name: string | undefined) {
  return useQuery({
    queryKey: ['epidemic-profile', name],
    enabled: !!name,
    staleTime: MONTH,
    gcTime: MONTH,
    retry: false,
    queryFn: async (): Promise<EpidemicProfile | null> => {
      const response = await lumioGet(`/artist-profile/epidemic?name=${encodeURIComponent(name!)}`)
      if (!response?.ok) return null
      const profile = (await response.json()) as EpidemicProfile
      // Only the same artist (a page for a namesake would be someone else).
      return sameName(profile.name, name) ? profile : null
    },
  })
}

/**
 * An artist's picture, the best there is: their own photo on Epidemic Sound (artists who publish there keep it
 * current), else Jellyfin's, else a photo from Deezer (many artists have none in Jellyfin). Kept for a month.
 */
export function useArtistPhoto(artist: BaseItemDto | undefined, size = 360): string | undefined {
  const { api } = useAuthedSession()
  const isArtist = !!artist && (artist.Type === 'MusicArtist' || !artist.Type)
  const name = isArtist ? (artist?.Name ?? '') : ''
  const epidemic = useEpidemicProfile(name || undefined)
  const own = artist ? portraitImageUrl(api, artist, { fillHeight: size }) : undefined
  const fallback = useQuery({
    queryKey: ['artist-photo', name],
    enabled: isArtist && !own && !!name && epidemic.isFetched && !epidemic.data?.image,
    staleTime: MONTH,
    gcTime: MONTH,
    retry: false,
    queryFn: () => deezerPhoto(name),
  })
  const fromEpidemic = epidemic.data?.image ? relayedImage(epidemic.data.image) : undefined
  return fromEpidemic ?? own ?? fallback.data ?? undefined
}

/**
 * The artist's description in the app's language where there is one; else the best one there is, rather than none:
 * Last.fm in the app's language, then Epidemic Sound (English; written by the artists themselves), then Last.fm in
 * English, then Jellyfin's.
 */
export function useArtistBio(artist: BaseItemDto | undefined, enabled = true): string {
  useLocale()
  const name = enabled ? (artist?.Name ?? undefined) : undefined
  const lastfm = useLastfmArtist(name)
  const epidemic = useEpidemicProfile(name)
  const english = getLocale() === 'en'
  const own = lastfm.data?.bio ?? ''
  const fromEpidemic = epidemic.data?.description ?? ''
  const fallback = lastfm.data?.bioEnglish ?? ''
  const jellyfin = plainText(artist?.Overview)
  return english ? fromEpidemic || own || jellyfin : own || fromEpidemic || fallback || jellyfin
}
