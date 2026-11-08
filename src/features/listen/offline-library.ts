import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { markServerReachable } from '@/lib/network'
import { downloadedVideoIds } from '@/features/player/video-downloads'
import { downloadedCollections } from './player/downloads'

/**
 * What the downloads need to be found without a connection: the songs' items, their albums and playlists, and their
 * artists, kept beside the downloaded files; for Watch's downloads the films, episodes, their series and seasons, and
 * the other episodes of a downloaded episode's season (shown greyed out). When a request to Jellyfin fails because the network is gone, it is
 * answered from here, as Jellyfin would answer it for the downloaded part of the library, so the library, album,
 * playlist and artist pages keep working offline (Spotify's offline mode shows the downloads only, too).
 */
const CACHE_NAME = 'lumio-downloads-v1'
const META = new Request('https://lumio.downloads/meta/items')

let items = new Map<string, BaseItemDto>()
const loaded: Promise<void> = (async () => {
  try {
    if (typeof caches === 'undefined') return
    const response = await (await caches.open(CACHE_NAME)).match(META)
    if (response) items = new Map(Object.entries((await response.json()) as Record<string, BaseItemDto>))
  } catch {
    // Nothing kept yet.
  }
})()

let saveTimer: number | undefined
function save() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void caches
      .open(CACHE_NAME)
      .then((cache) => cache.put(META, new Response(JSON.stringify(Object.fromEntries(items)), { headers: { 'Content-Type': 'application/json' } })))
      .catch(() => undefined)
  }, 500)
}

/** A kept item (for names in the download manager). */
export const offlineItem = (id: string) => items.get(id)

/** Keeps items for offline use (a downloaded collection, its songs and artists). */
export function rememberItems(list: Array<BaseItemDto | null | undefined>) {
  for (const item of list) if (item?.Id) items.set(item.Id, item)
  save()
}

// ---- answering Jellyfin's requests offline ----

const ITEM_PATH = /\/(?:Users\/[0-9a-f-]+\/)?Items\/([0-9a-f]{32})$/i
const LIST_PATH = /\/(?:Users\/[0-9a-f-]+\/)?Items$/i
const ARTISTS_PATH = /\/Artists(?:\/AlbumArtists)?$/i
const SEASONS_PATH = /\/Shows\/([0-9a-f]{32})\/Seasons$/i
const EPISODES_PATH = /\/Shows\/([0-9a-f]{32})\/Episodes$/i
const VIDEO_TYPES = ['Movie', 'Series', 'Episode', 'Season']

/** Only what downloads still hold: collections removed since leave their items unused. */
function available() {
  const collections = downloadedCollections()
  const kept = new Set(collections.flatMap((collection) => [collection.key.split(':')[1] ?? '', ...collection.ids]))
  const all = [...items.values()]
  const tracks = all.filter((item) => item.Type === 'Audio' && kept.has(item.Id!))
  const albumIds = new Set(tracks.map((track) => track.AlbumId))
  const artistIds = new Set(tracks.flatMap((track) => [...(track.ArtistItems ?? []), ...(track.AlbumArtists ?? [])].map((artist) => artist.Id)))
  const videos = downloadedVideoIds()
  const seriesIds = new Set(all.filter((item) => item.Type === 'Episode' && videos.has(item.Id!)).map((episode) => episode.SeriesId))
  return {
    collections,
    tracks,
    albums: all.filter((item) => item.Type === 'MusicAlbum' && albumIds.has(item.Id)),
    playlists: all.filter((item) => item.Type === 'Playlist' && kept.has(item.Id!)),
    artists: all.filter((item) => item.Type === 'MusicArtist' && artistIds.has(item.Id)),
    movies: all.filter((item) => item.Type === 'Movie' && videos.has(item.Id!)),
    series: all.filter((item) => item.Type === 'Series' && seriesIds.has(item.Id)),
    seasons: all.filter((item) => item.Type === 'Season' && seriesIds.has(item.SeriesId)),
    // Every kept episode of those series, downloaded or not: the pages grey out the rest.
    episodes: all.filter((item) => item.Type === 'Episode' && seriesIds.has(item.SeriesId)),
  }
}

const byEpisodeOrder = (a: BaseItemDto, b: BaseItemDto) => (a.ParentIndexNumber ?? 0) - (b.ParentIndexNumber ?? 0) || (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0)

const list = (params: URLSearchParams, name: string) => (params.get(name) ?? params.get(name[0]!.toUpperCase() + name.slice(1)) ?? '').split(',').filter(Boolean)

/** The answer Jellyfin would give for the downloaded part of the library, or null for requests that can't be answered. */
function answer(url: URL): unknown {
  const path = url.pathname
  const params = url.searchParams
  const library = available()
  const one = path.match(ITEM_PATH)?.[1]
  if (one) return items.get(one) ?? null
  const result = (found: BaseItemDto[]) => ({ Items: found, TotalRecordCount: found.length, StartIndex: 0 })
  if (ARTISTS_PATH.test(path)) return result(library.artists)
  const seasonsOf = path.match(SEASONS_PATH)?.[1]
  if (seasonsOf) return result(library.seasons.filter((season) => season.SeriesId === seasonsOf).sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0)))
  const episodesOf = path.match(EPISODES_PATH)?.[1]
  if (episodesOf) {
    const season = params.get('seasonId') ?? params.get('SeasonId')
    let found = library.episodes.filter((episode) => episode.SeriesId === episodesOf && (!season || episode.SeasonId === season)).sort(byEpisodeOrder)
    // From an episode on (the next episode, the ones stored ahead), as many as asked for.
    const start = params.get('startItemId') ?? params.get('StartItemId')
    if (start) {
      const at = found.findIndex((episode) => episode.Id === start)
      found = at < 0 ? [] : found.slice(at)
    }
    const limit = Number(params.get('limit') ?? params.get('Limit'))
    return result(limit > 0 ? found.slice(0, limit) : found)
  }
  if (!LIST_PATH.test(path)) return null
  const types = list(params, 'includeItemTypes')
  const ids = list(params, 'ids')
  if (ids.length) return result(ids.map((id) => items.get(id)).filter((item): item is BaseItemDto => !!item))
  const parent = params.get('parentId') ?? params.get('ParentId')
  if (parent) {
    const playlist = library.collections.find((collection) => collection.key === `playlist:${parent}`)
    if (playlist) return result(playlist.ids.map((id) => items.get(id)).filter((item): item is BaseItemDto => !!item))
    const inAlbum = library.tracks.filter((track) => track.AlbumId === parent)
    if (inAlbum.length) return result(inAlbum.sort(byEpisodeOrder))
    const inSeason = library.episodes.filter((episode) => episode.SeasonId === parent)
    if (inSeason.length) return result(inSeason.sort(byEpisodeOrder))
    const seasons = library.seasons.filter((season) => season.SeriesId === parent)
    if (seasons.length) return result(seasons)
  }
  const artist = [...list(params, 'artistIds'), ...list(params, 'albumArtistIds'), ...list(params, 'contributingArtistIds')][0]
  const byArtist = (item: BaseItemDto) => !artist || [...(item.ArtistItems ?? []), ...(item.AlbumArtists ?? [])].some((entry) => entry.Id === artist)
  const favorites = list(params, 'filters').includes('IsFavorite')
  const pool = [
    ...(types.length === 0 || types.includes('Audio') ? library.tracks : []),
    ...(types.length === 0 || types.includes('MusicAlbum') ? library.albums : []),
    ...(types.includes('Playlist') ? library.playlists : []),
    ...(types.includes('MusicArtist') ? library.artists : []),
  ]
  // Watch's kinds: the downloaded films and the series with downloaded episodes.
  if (types.length && types.some((type) => VIDEO_TYPES.includes(type))) {
    const videos = [
      ...(types.includes('Movie') ? library.movies : []),
      ...(types.includes('Series') ? library.series : []),
      ...(types.includes('Episode') ? library.episodes.filter((episode) => downloadedVideoIds().has(episode.Id!)) : []),
    ]
    return result(videos.filter((item) => !favorites || item.UserData?.IsFavorite))
  }
  // Other kinds (books …) aren't kept offline.
  if (types.length && !types.some((type) => ['Audio', 'MusicAlbum', 'Playlist', 'MusicArtist'].includes(type))) return result([])
  return result(pool.filter((item) => byArtist(item) && (!favorites || item.UserData?.IsFavorite || item.Type === 'Playlist')))
}

/**
 * Answers failed requests to Jellyfin from the offline library while there is no network. Only for reading (GET)
 * and only when the request failed without an answer (offline), never when Jellyfin answered with an error.
 */
export function installOfflineLibrary() {
  axios.interceptors.response.use(
    (response) => {
      // An answer: the server is there.
      markServerReachable(true)
      return response
    },
    async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) markServerReachable(true)
    if (!axios.isAxiosError(error) || error.response || error.config?.method?.toLowerCase() !== 'get' || !error.config.url) throw error
    let url: URL
    try {
      url = new URL(axios.getUri(error.config))
    } catch {
      throw error
    }
    // No answer at all: offline (or the server is down) until it answers again.
    if (error.code !== 'ERR_CANCELED') {
      markServerReachable(false)
      watchForServer(url.origin + url.pathname.replace(/\/(Users|Items|Artists|Audio|Shows|Sessions|Playlists)\b.*$/i, ''))
    }
    await loaded
    const data = answer(url)
    if (data === null) throw error
    return { data, status: 200, statusText: 'OK (offline)', headers: {}, config: error.config as InternalAxiosRequestConfig } satisfies AxiosResponse
    },
  )
}

let watching: number | undefined

/** While the server can't be reached, asks every 15 seconds whether it is back (its answers end offline mode). */
function watchForServer(base: string) {
  if (watching) return
  watching = window.setInterval(() => {
    if (!navigator.onLine) return
    void fetch(`${base}/System/Ping`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok && response.status >= 500) return
        markServerReachable(true)
        window.clearInterval(watching)
        watching = undefined
      })
      .catch(() => undefined)
  }, 15_000)
}
