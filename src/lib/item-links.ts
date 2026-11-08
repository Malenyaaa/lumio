import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { externalOf } from './external-items'

/** The address of a title's own page: films under /movie, series under /show, albums and artists under /album and /artist, everything else under /item. */
export function titlePath(type: string | null | undefined, id: string): string {
  if (type === 'Movie') return `/movie/${id}`
  if (type === 'Series') return `/show/${id}`
  // Music lives in the Listen app.
  if (type === 'MusicAlbum') return `/listen/album/${id}`
  if (type === 'MusicArtist') return `/listen/artist/${id}`
  if (type === 'Playlist') return `/listen/playlist/${id}`
  return `/item/${id}`
}

/** Square artwork (album covers, artist photos) rather than a poster. */
export const SQUARE_TYPES = new Set(['MusicAlbum', 'MusicArtist', 'Audio', 'AudioBook'])

/** The artists credited on an album or track, as links to their pages where Jellyfin has an artist item for them. */
export function artistsOf(item: BaseItemDto): Array<{ id?: string; name: string }> {
  const items = item.Type === 'MusicAlbum' ? item.AlbumArtists : item.ArtistItems
  if (items?.length) return items.map((artist) => ({ id: artist.Id ?? undefined, name: artist.Name ?? '' }))
  const names = item.Type === 'MusicAlbum' ? [item.AlbumArtist] : item.Artists
  return (names ?? []).filter((name): name is string => !!name).map((name) => ({ name }))
}

/** Where a card for this item leads: episodes open their series (scrolled to the episode), tracks their album. */
export function itemHref(item: BaseItemDto): string {
  const external = externalOf(item)
  if (external) return external.href
  switch (item.Type) {
    case 'Episode':
      if (!item.SeriesId) break
      return `/show/${item.SeriesId}?${new URLSearchParams({ ...(item.SeasonId ? { season: item.SeasonId } : {}), episode: item.Id! })}`
    case 'Season':
      if (!item.SeriesId) break
      return `/show/${item.SeriesId}?season=${item.Id}`
    case 'Playlist':
      // Video playlists are Watch's; Listen's playlist page plays music.
      if (item.MediaType === 'Video') return `/item/${item.Id}`
      break
    case 'Audio': {
      const albumId = item.AlbumId ?? item.ParentId
      if (albumId) return `/listen/album/${albumId}`
      break
    }
  }
  return titlePath(item.Type, item.Id!)
}

/** Link to the player; resumes where the user stopped. `extra` carries choices such as audio track (`a`) or subtitle (`s`). */
export function playHref(item: BaseItemDto, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams()
  const ticks = item.UserData?.PlaybackPositionTicks
  if (ticks) params.set('t', String(ticks))
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) params.set(key, String(value))
  const query = params.toString()
  return `/play/${item.Id}${query ? `?${query}` : ''}`
}

/** Only whole titles go on the watchlist, never single episodes, tracks or seasons. */
export const WATCHLIST_TYPES = new Set(['Movie', 'Series', 'BoxSet', 'MusicAlbum', 'Book'])
