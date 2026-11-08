import type { Api } from '@jellyfin/sdk'
import { BaseItemKind, ItemFields, ItemSortBy, SortOrder, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getArtistApi } from '@jellyfin/sdk/lib/utils/api/artist-api'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { externalOf } from '@/lib/external-items'
import { artistsOf } from '@/lib/item-links'
import { fetchSimilarArtists, sameName } from './external'
import { music } from './player/music-player'

/**
 * Radio, as Spotify's: an artist's songs mixed with songs of artists who make similar music (Last.fm's similar
 * artists, as far as the library has them; otherwise artists sharing their genres). Also what keeps music going when
 * the queue runs out ("autoplay"): more of what was just played.
 */
const RADIO_SIZE = 50
/** Songs of the artist itself in a radio, the rest from similar artists. */
const OWN_SHARE = 0.4
const SIMILAR_ARTISTS = 8

const fields = [ItemFields.PrimaryImageAspectRatio, ItemFields.Genres]

function shuffled<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

async function artistTracks(api: Api, userId: string, artistId: string, limit: number) {
  return (
    (
      await getLibraryApi(api).getItems({
        userId,
        recursive: true,
        includeItemTypes: [BaseItemKind.Audio],
        artistIds: [artistId],
        sortBy: [ItemSortBy.PlayCount, ItemSortBy.Random],
        sortOrder: [SortOrder.Descending, SortOrder.Ascending],
        fields,
        limit,
      })
    ).data.Items ?? []
  )
}

/** The library's artists similar to one (Last.fm), or else artists sharing its genres. */
async function similarArtists(api: Api, userId: string, queryClient: QueryClient, artist: { id: string; name: string; genres?: string[] }) {
  const library = await queryClient.fetchQuery({
    queryKey: ['radio-artists', userId],
    staleTime: 30 * 60_000,
    queryFn: async () => (await getArtistApi(api).getAlbumArtists({ userId, fields: [ItemFields.Genres] })).data.Items ?? [],
  })
  const names = await fetchSimilarArtists(artist.name).catch(() => [] as string[])
  const matched = names
    .map((name) => library.find((candidate) => sameName(candidate.Name, name)))
    .filter((candidate): candidate is BaseItemDto => !!candidate && candidate.Id !== artist.id)
  if (matched.length) return matched.slice(0, SIMILAR_ARTISTS)
  const genres = new Set(artist.genres ?? [])
  return shuffled(library.filter((candidate) => candidate.Id !== artist.id && candidate.Genres?.some((genre) => genres.has(genre)))).slice(0, SIMILAR_ARTISTS)
}

/** Builds a radio around an artist: their songs and similar artists' songs, interleaved and shuffled. */
export async function buildRadio(api: Api, userId: string, queryClient: QueryClient, artist: { id: string; name: string; genres?: string[] }, exclude = new Set<string>()) {
  const [own, similar] = await Promise.all([artistTracks(api, userId, artist.id, 40), similarArtists(api, userId, queryClient, artist)])
  const others = (await Promise.all(similar.map((entry) => artistTracks(api, userId, entry.Id!, 8)))).flat()
  const fresh = (list: BaseItemDto[]) => shuffled(list.filter((track) => track.Id && !exclude.has(track.Id)))
  const ownPart = fresh(own).slice(0, Math.round(RADIO_SIZE * OWN_SHARE))
  const otherPart = fresh(others).slice(0, RADIO_SIZE - ownPart.length)
  // Interleave, so the artist comes back every few songs.
  const mixed: BaseItemDto[] = []
  const seen = new Set<string>()
  for (let i = 0; mixed.length < RADIO_SIZE && (i < ownPart.length || i < otherPart.length * 2); i++) {
    for (const track of [ownPart[i], otherPart[i * 2], otherPart[i * 2 + 1]]) {
      if (track?.Id && !seen.has(track.Id)) {
        seen.add(track.Id)
        mixed.push(track)
      }
    }
  }
  return { tracks: mixed, similar }
}

/** The library's artists most like one (for a radio's cover). */
export function useSimilarLibraryArtists(artist: BaseItemDto | undefined) {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['radio-similar', session.userId, artist?.Id],
    enabled: !!artist?.Id,
    staleTime: 60 * 60_000,
    queryFn: () => similarArtists(api, session.userId, queryClient, { id: artist!.Id!, name: artist!.Name ?? '', genres: artist!.Genres ?? undefined }),
  })
}

/** Starts an artist's radio. */
export function useArtistRadio() {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  return async (artist: BaseItemDto) => {
    const { tracks } = await buildRadio(api, session.userId, queryClient, { id: artist.Id!, name: artist.Name ?? '', genres: artist.Genres ?? undefined })
    if (tracks.length) music.play(tracks, 0, { source: `radio:${artist.Id}`, shuffle: false })
  }
}

/**
 * "Autoplay": when the queue runs out, more of what was just played, around the last song's artist, without
 * repeating what the queue already had. Library tracks only (podcasts just end).
 */
export async function continuation(api: Api, userId: string, queryClient: QueryClient, played: BaseItemDto[]) {
  const last = [...played].reverse().find((track) => !externalOf(track))
  const artist = last && artistsOf(last)[0]
  if (!last || !artist?.id) return []
  const exclude = new Set(played.map((track) => track.Id!).filter(Boolean))
  const { tracks } = await buildRadio(api, userId, queryClient, { id: artist.id, name: artist.name, genres: last.Genres ?? undefined }, exclude)
  return tracks.slice(0, 20)
}

