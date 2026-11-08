import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { relayedImage, relayFetch } from '@/features/social/social'
import { portraitImageUrl } from '@/lib/images'
import { sameName } from './external'

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

/**
 * An artist's picture: Jellyfin's own, or else a photo from Deezer (many artists have none in Jellyfin when its
 * metadata providers found nothing). Kept for a month.
 */
export function useArtistPhoto(artist: BaseItemDto | undefined, size = 360): string | undefined {
  const { api } = useAuthedSession()
  const own = artist ? portraitImageUrl(api, artist, { fillHeight: size }) : undefined
  const name = artist?.Name ?? ''
  const fallback = useQuery({
    queryKey: ['artist-photo', name],
    enabled: !own && !!name && (artist?.Type === 'MusicArtist' || !artist?.Type),
    staleTime: MONTH,
    gcTime: MONTH,
    retry: false,
    queryFn: () => deezerPhoto(name),
  })
  return own ?? fallback.data ?? undefined
}
