import type { Api } from '@jellyfin/sdk'
import { BaseItemKind, ItemFields, ItemSortBy, SortOrder, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getArtistApi } from '@jellyfin/sdk/lib/utils/api/artist-api'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { useItem } from '@/features/items/queries'
import { readLocalSettings } from '@/features/settings/local-settings'
import { externalOf } from '@/lib/external-items'
import { defineMessages, getLocale, messagesFor } from '@/lib/i18n'
import { artistsOf } from '@/lib/item-links'
import { fetchSimilarArtists, sameName } from './external'
import type { OfficialPlaylist } from './official'
import { seeded, weightedShuffle } from './official'
import { music } from './player/music-player'
import { countsForTaste, NO_EXCLUSIONS, tasteWeight, useTasteFilter } from './taste'

/**
 * Radio, as Spotify's: an artist's songs mixed with songs of artists who make similar music (Last.fm's similar
 * artists, as far as the library has them; otherwise artists sharing their genres), leaning towards what the listener
 * likes. Each listener has their own radio of an artist, made anew every day (the same all day). Also what keeps music
 * going when the queue runs out ("autoplay"): more of what was just played.
 */
const RADIO_SIZE = 50
/** Songs of the artist itself in a radio, the rest from similar artists. */
const OWN_SHARE = 0.4
const SIMILAR_ARTISTS = 8
const DAY = 24 * 60 * 60_000

const fields = [ItemFields.PrimaryImageAspectRatio, ItemFields.Genres]

const messages = defineMessages({
  de: {
    title: (name: string) => `${name} Radio`,
    with: (names: string[]) => (names.length ? `Mit ${names.join(', ')} und anderen Künstler*innen` : 'Songs wie diese, jeden Tag neu gemischt.'),
  },
  en: {
    title: (name: string) => `${name} Radio`,
    with: (names: string[]) => (names.length ? `With ${names.join(', ')} and more` : 'Songs like these, mixed anew every day.'),
  },
})

async function artistTracks(api: Api, userId: string, artistId: string, limit: number) {
  return (
    (
      await getLibraryApi(api).getItems({
        userId,
        recursive: true,
        includeItemTypes: [BaseItemKind.Audio],
        artistIds: [artistId],
        sortBy: [ItemSortBy.PlayCount, ItemSortBy.SortName],
        sortOrder: [SortOrder.Descending, SortOrder.Ascending],
        fields,
        limit,
      })
    ).data.Items ?? []
  )
}

/** The library's artists similar to one (Last.fm), or else artists sharing its genres. */
async function similarArtists(api: Api, userId: string, queryClient: QueryClient, artist: { id: string; name: string; genres?: string[] }, seed = '') {
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
  const sharing = library.filter((candidate) => candidate.Id !== artist.id && candidate.Genres?.some((genre) => genres.has(genre)))
  return weightedShuffle(sharing, () => 0, `${seed}:${artist.id}:similar`).slice(0, SIMILAR_ARTISTS)
}

interface RadioOptions {
  /** Tracks not to take (what the queue already had). */
  exclude?: Set<string>
  /** The same seed makes the same radio. */
  seed?: string
  /** Which tracks count for the listener's taste (they weigh more). */
  counts?: (track: BaseItemDto) => boolean
}

/** Builds a radio around an artist: their songs and similar artists' songs, interleaved, leaning towards the taste. */
export async function buildRadio(api: Api, userId: string, queryClient: QueryClient, artist: { id: string; name: string; genres?: string[] }, options: RadioOptions = {}) {
  const seed = options.seed ?? String(Math.random())
  const counts = options.counts ?? (() => true)
  const [own, similar] = await Promise.all([artistTracks(api, userId, artist.id, 200), similarArtists(api, userId, queryClient, artist, seed)])
  const others = (await Promise.all(similar.map((entry) => artistTracks(api, userId, entry.Id!, 40)))).flat()
  const pick = (list: BaseItemDto[], part: string) =>
    weightedShuffle(
      list.filter((track) => track.Id && !options.exclude?.has(track.Id)),
      (track) => tasteWeight(track, counts),
      `${seed}:${part}`,
    )
  const ownPart = pick(own, 'own').slice(0, Math.round(RADIO_SIZE * OWN_SHARE))
  // From the similar artists: no more than eight songs each, so one of them doesn't take over.
  const perArtist = new Map<string, number>()
  const otherPart = pick(others, 'others')
    .filter((track) => {
      const key = artistsOf(track)[0]?.id ?? ''
      perArtist.set(key, (perArtist.get(key) ?? 0) + 1)
      return perArtist.get(key)! <= 8
    })
    .slice(0, RADIO_SIZE - ownPart.length)
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

/** Today's radio of an artist for this listener: its query, shared by the page, the cards and "Go to radio". */
function radioQuery(api: Api, userId: string, queryClient: QueryClient, artist: BaseItemDto, taste: ReturnType<typeof useTasteFilter>) {
  const day = Math.floor(Date.now() / DAY)
  return {
    queryKey: ['radio-playlist', userId, artist.Id, day, taste.key, getLocale()],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<OfficialPlaylist> => {
      const t = messagesFor(messages)
      const { tracks, similar } = await buildRadio(
        api,
        userId,
        queryClient,
        { id: artist.Id!, name: artist.Name ?? '', genres: artist.Genres ?? undefined },
        { seed: `${userId}:${artist.Id}:${day}`, counts: taste.counts },
      )
      return {
        slug: `radio-${artist.Id}`,
        kind: 'radio',
        personal: true,
        artist,
        title: t.title(artist.Name ?? ''),
        description: t.with(similar.slice(0, 3).map((entry) => entry.Name ?? '').filter(Boolean)),
        tracks,
      }
    },
  }
}

/** An artist's radio as a playlist (its page at /listen/official/radio-<artist id>). */
export function useRadioPlaylist(artistId: string | undefined) {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const taste = useTasteFilter()
  const artist = useItem(artistId ?? '', !!artistId).data
  const query = useQuery({
    ...(artist ? radioQuery(api, session.userId, queryClient, artist, taste) : { queryKey: ['radio-playlist', 'none'], queryFn: async () => null as unknown as OfficialPlaylist }),
    enabled: !!artist && taste.ready,
  })
  return { playlist: artistId ? query.data : undefined, isLoading: !!artistId && (!artist || query.isPending) }
}

/** Starts an artist's radio (today's, the same as its page shows). */
export function useArtistRadio() {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const taste = useTasteFilter()
  return async (artist: BaseItemDto) => {
    const radio = await queryClient.fetchQuery(radioQuery(api, session.userId, queryClient, artist, taste))
    if (radio.tracks.length) music.play(radio.tracks, 0, { source: `official:${radio.slug}`, shuffle: false })
  }
}

/**
 * "Autoplay": when the queue runs out, more of what was just played, around the last song's artist (one that counts
 * for the taste profile), without repeating what the queue already had. Library tracks only (podcasts just end).
 */
export async function continuation(api: Api, userId: string, queryClient: QueryClient, played: BaseItemDto[]) {
  const exclusions = { ...NO_EXCLUSIONS, ...readLocalSettings(userId).tasteExclusions }
  const counts = (track: BaseItemDto) => countsForTaste(track, exclusions, new Set())
  const library = played.filter((track) => !externalOf(track))
  const last = [...library].reverse().find(counts) ?? library.at(-1)
  const artist = last && artistsOf(last)[0]
  if (!last || !artist?.id) return []
  const exclude = new Set(played.map((track) => track.Id!).filter(Boolean))
  const random = seeded(`${userId}:${Date.now()}`)
  const { tracks } = await buildRadio(api, userId, queryClient, { id: artist.id, name: artist.name, genres: last.Genres ?? undefined }, { exclude, counts, seed: String(random()) })
  return tracks.slice(0, 20)
}
