import type { Api } from '@jellyfin/sdk'
import { BaseItemKind, ImageType, ItemFields, ItemFilter, ItemSortBy, SortOrder, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { useNextUp, useResumeItems } from './queries'

/**
 * The personal home screen: instead of Jellyfin's fixed rows ("latest in each library"), rows built from what the user
 * actually watches. Everything is derived from the watch history:
 * - continue: in-progress titles and the next episode of series, merged, most recently watched first
 * - because:  titles similar to the last things watched
 * - genre:    unwatched, well-rated titles of the genres watched most (recent viewing counts more)
 * - discover: a genre the user hardly watches, its best titles (changes daily)
 * - new:      recently added titles
 */

export type PersonalRow =
  | { id: string; kind: 'continue'; items: BaseItemDto[]; loading: boolean }
  | { id: string; kind: 'because'; source: BaseItemDto; items: BaseItemDto[]; loading: boolean }
  | { id: string; kind: 'genre' | 'discover'; genre: string; items: BaseItemDto[]; loading: boolean }
  | { id: string; kind: 'new'; items: BaseItemDto[]; loading: boolean }

const fields = [ItemFields.PrimaryImageAspectRatio, ItemFields.Overview, ItemFields.Genres]
const TITLE_TYPES = [BaseItemKind.Movie, BaseItemKind.Series]
const HISTORY_SIZE = 150
/** Viewing from this many days ago counts about a third as much as today's. */
const DECAY_DAYS = 60
const ROW_SIZE = 20
const GENRE_ROWS = 3
const BECAUSE_ROWS = 2
const STALE = 10 * 60_000
const MIN_DISCOVER_TITLES = 8

/** The title an entry belongs to: the series for episodes, the item itself otherwise. */
/** At most this many hero slides come from "continue"; the rest are titles the user hasn't watched yet. */
const FEATURED_CONTINUE = 3
/** How long the hero's picks of new titles stay the same: three different sets a day. */
const SPOTLIGHT_SLOT_MS = 8 * 60 * 60_000

const hasBackdrop = (item: BaseItemDto) => !!(item.BackdropImageTags?.length || item.ParentBackdropImageTags?.length)

/** The current 8-hour slot in local time (00–08, 08–16, 16–24). */
function spotlightSlot() {
  const local = Date.now() - new Date().getTimezoneOffset() * 60_000
  return Math.floor(local / SPOTLIGHT_SLOT_MS)
}

/** A random number generator that always gives the same sequence for the same seed. */
function seededRandom(seed: string) {
  let state = 0
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** Candidates for the hero's new titles: unwatched films and series, the newest additions and the best rated. */
function useSpotlightPool(api: Api, userId: string) {
  return useQuery({
    queryKey: ['home-spotlight', userId],
    staleTime: STALE,
    queryFn: async () => {
      const request = (sortBy: ItemSortBy[]) =>
        getLibraryApi(api).getItems({
          userId,
          recursive: true,
          includeItemTypes: TITLE_TYPES,
          isPlayed: false,
          imageTypes: [ImageType.Backdrop],
          sortBy,
          sortOrder: [SortOrder.Descending],
          fields,
          limit: 40,
        })
      const [newest, best] = await Promise.all([request([ItemSortBy.DateCreated]), request([ItemSortBy.CommunityRating])])
      const byId = new Map([...(newest.data.Items ?? []), ...(best.data.Items ?? [])].map((item) => [item.Id, item]))
      // Sorted by id so the seeded pick doesn't depend on the order the server returned them in.
      return [...byId.values()].filter((item) => !item.UserData?.Played).sort((a, b) => (a.Id ?? '').localeCompare(b.Id ?? ''))
    },
  })
}

/**
 * The hero's slides: up to three titles from "continue" (live, most recent first) and the rest drawn from the
 * unwatched pool, at least two. The draw is seeded with the user and the current 8-hour slot, so the new titles stay
 * put for a few hours instead of changing on every visit. Continue and new titles take turns.
 */
function featuredMix(continueItems: BaseItemDto[], pool: BaseItemDto[], seed: string): BaseItemDto[] {
  const taken = new Set<string>()
  const watching: BaseItemDto[] = []
  for (const item of continueItems) {
    const id = titleId(item)
    if (!id || taken.has(id) || !hasBackdrop(item)) continue
    taken.add(id)
    watching.push(item)
    if (watching.length === FEATURED_CONTINUE) break
  }

  const random = seededRandom(seed)
  const candidates = pool.filter((item) => item.Id && !taken.has(item.Id) && hasBackdrop(item))
  const fresh: BaseItemDto[] = []
  while (fresh.length < FEATURED - watching.length && candidates.length) {
    fresh.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0]!)
  }

  const mixed: BaseItemDto[] = []
  for (let i = 0; i < Math.max(watching.length, fresh.length); i++) {
    if (watching[i]) mixed.push(watching[i]!)
    if (fresh[i]) mixed.push(fresh[i]!)
  }
  return mixed.slice(0, FEATURED)
}

const titleId = (item: BaseItemDto) => (item.Type === 'Episode' ? item.SeriesId : item.Id) ?? undefined
const playedAt = (item: BaseItemDto) => Date.parse(item.UserData?.LastPlayedDate ?? '') || 0

function useHistory(api: Api, userId: string) {
  return useQuery({
    queryKey: ['home-history', userId],
    staleTime: STALE,
    queryFn: async () =>
      (
        await getLibraryApi(api).getItems({
          userId,
          recursive: true,
          filters: [ItemFilter.IsPlayed],
          includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Episode],
          sortBy: [ItemSortBy.DatePlayed],
          sortOrder: [SortOrder.Descending],
          fields: [ItemFields.Genres],
          enableImages: false,
          limit: HISTORY_SIZE,
        })
      ).data.Items ?? [],
  })
}

/** The titles behind the history (episodes carry no genres of their own; their series does). */
function useHistoryTitles(api: Api, userId: string, history: BaseItemDto[] | undefined) {
  const ids = [...new Set((history ?? []).map(titleId).filter((id): id is string => !!id))]
  return useQuery({
    queryKey: ['home-history-titles', userId, ids],
    enabled: !!history,
    staleTime: STALE,
    queryFn: async () =>
      ids.length === 0 ? [] : ((await getLibraryApi(api).getItems({ userId, ids, fields, enableImages: true })).data.Items ?? []),
  })
}

interface Taste {
  /** Genres by weight, most watched first. */
  genres: string[]
  /** Distinct titles, most recently watched first. */
  recent: BaseItemDto[]
}

function tasteFrom(history: BaseItemDto[], titles: BaseItemDto[]): Taste {
  const byId = new Map(titles.map((title) => [title.Id, title]))
  const weights = new Map<string, number>()
  const recent: BaseItemDto[] = []
  const seen = new Set<string>()
  const now = Date.now()
  for (const entry of history) {
    const id = titleId(entry)
    const title = id ? byId.get(id) : undefined
    if (!id || !title) continue
    const age = Math.max(0, (now - playedAt(entry)) / 86_400_000)
    // A binge of 20 episodes shouldn't outweigh everything else: each further episode of a title counts less.
    const repeat = seen.has(id) ? 0.25 : 1
    const weight = Math.exp(-age / DECAY_DAYS) * repeat
    for (const genre of title.Genres ?? []) weights.set(genre, (weights.get(genre) ?? 0) + weight)
    if (!seen.has(id)) {
      seen.add(id)
      recent.push(title)
    }
  }
  return { genres: [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre), recent }
}

/** Same pick all day, a different one tomorrow. */
function dailyPick<T>(list: T[]): T | undefined {
  if (list.length === 0) return undefined
  const day = Math.floor(Date.now() / 86_400_000)
  return list[(day * 2654435761) % list.length]
}

/** Titles for the hero: what the user is in the middle of first, topped up with suggestions so there are a few. */
const FEATURED = 5

export function usePersonalHome(): { rows: PersonalRow[]; featured: BaseItemDto[]; loading: boolean } {
  const { api, session } = useAuthedSession()
  const userId = session.userId
  const resume = useResumeItems()
  const nextUp = useNextUp()
  const history = useHistory(api, userId)
  const titles = useHistoryTitles(api, userId, history.data)
  const taste = history.data && titles.data ? tasteFrom(history.data, titles.data) : undefined

  // ---- continue: resume + next up as one row ----
  const lastBySeries = new Map<string, number>()
  for (const entry of history.data ?? []) {
    const id = titleId(entry)
    if (id && !lastBySeries.has(id)) lastBySeries.set(id, playedAt(entry))
  }
  const inProgress = resume.data ?? []
  const seriesInProgress = new Set(inProgress.map((item) => item.SeriesId).filter(Boolean))
  const continueItems = [
    ...inProgress.map((item) => ({ item, at: playedAt(item) })),
    // The next episode of a series that already has one in progress would be the same title twice.
    ...(nextUp.data ?? [])
      .filter((item) => !seriesInProgress.has(item.SeriesId))
      .map((item) => ({ item, at: lastBySeries.get(item.SeriesId ?? '') ?? 0 })),
  ]
    .sort((a, b) => b.at - a.at)
    .map(({ item }) => item)

  // The order needs the history too (when each series was last played); without it the row (and the hero built from
  // it) would first show one order and then reshuffle.
  const continueLoading = resume.isLoading || nextUp.isLoading || history.isLoading

  // ---- because you watched ----
  const sources = (taste?.recent ?? []).slice(0, BECAUSE_ROWS)
  const similar = useQueries({
    queries: sources.map((source) => ({
      queryKey: ['home-similar', userId, source.Id],
      staleTime: STALE,
      queryFn: async () =>
        (
          (await getLibraryApi(api).getSimilarItems({ itemId: source.Id!, userId, limit: ROW_SIZE + 10, fields })).data.Items ?? []
        ).filter((item) => !item.UserData?.Played),
    })),
  })

  // ---- favourite genres ----
  const topGenres = (taste?.genres ?? []).slice(0, GENRE_ROWS)
  const genreItems = useQueries({
    queries: topGenres.map((genre) => ({
      queryKey: ['home-genre', userId, genre],
      staleTime: STALE,
      queryFn: async () =>
        (
          await getLibraryApi(api).getItems({
            userId,
            recursive: true,
            genres: [genre],
            includeItemTypes: TITLE_TYPES,
            isPlayed: false,
            minCommunityRating: 6.5,
            sortBy: [ItemSortBy.Random],
            fields,
            limit: ROW_SIZE,
          })
        ).data.Items ?? [],
    })),
  })

  // ---- discover: a genre rarely watched ----
  // Jellyfin's genre endpoint reports the library totals for every genre, so the selection is counted here: unwatched
  // titles per genre, from one light list of all titles (no images).
  const allGenres = useQuery({
    queryKey: ['home-discover-genres', userId],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const titles =
        (
          await getLibraryApi(api).getItems({ userId, recursive: true, includeItemTypes: TITLE_TYPES, isPlayed: false, fields: [ItemFields.Genres], enableImages: false })
        ).data.Items ?? []
      const counts = new Map<string, number>()
      for (const title of titles) for (const genre of title.Genres ?? []) counts.set(genre, (counts.get(genre) ?? 0) + 1)
      // Only genres with a real selection; tag-like genres with two titles make a poor row.
      return [...counts.entries()].filter(([, count]) => count >= MIN_DISCOVER_TITLES).map(([genre]) => genre).sort()
    },
  })
  const familiar = new Set((taste?.genres ?? []).slice(0, 8))
  const discoverGenre = taste && allGenres.data ? dailyPick(allGenres.data.filter((genre) => genre && !familiar.has(genre))) : undefined
  const discover = useQuery({
    queryKey: ['home-discover', userId, discoverGenre],
    enabled: !!discoverGenre,
    staleTime: STALE,
    queryFn: async () =>
      (
        await getLibraryApi(api).getItems({
          userId,
          recursive: true,
          genres: [discoverGenre!],
          includeItemTypes: TITLE_TYPES,
          isPlayed: false,
          sortBy: [ItemSortBy.CommunityRating],
          sortOrder: [SortOrder.Descending],
          fields,
          limit: ROW_SIZE,
        })
      ).data.Items ?? [],
  })

  // ---- new ----
  const latest = useQuery({
    queryKey: ['home-new', userId],
    staleTime: STALE,
    queryFn: async () =>
      (
        await getLibraryApi(api).getItems({
          userId,
          recursive: true,
          includeItemTypes: TITLE_TYPES,
          sortBy: [ItemSortBy.DateCreated],
          sortOrder: [SortOrder.Descending],
          fields,
          limit: ROW_SIZE,
        })
      ).data.Items ?? [],
  })

  // Each title appears once on the page: rows further down skip what an earlier row already shows.
  const shown = new Set<string>()
  const fresh = (items: BaseItemDto[] | undefined) =>
    (items ?? []).filter((item) => {
      // Jellyfin's isPlayed filter doesn't reliably exclude fully watched series, so check again here.
      if (!item.Id || shown.has(item.Id) || item.UserData?.Played) return false
      shown.add(item.Id)
      return true
    }).slice(0, ROW_SIZE)

  const rows: PersonalRow[] = [
    { id: 'continue', kind: 'continue', items: continueItems, loading: continueLoading },
    ...sources.map((source, index): PersonalRow => ({
      id: `because-${source.Id}`,
      kind: 'because',
      source,
      items: fresh(similar[index]?.data),
      loading: !!similar[index]?.isLoading,
    })),
    ...topGenres.map((genre, index): PersonalRow => ({
      id: `genre-${genre}`,
      kind: 'genre',
      genre,
      items: fresh(genreItems[index]?.data),
      loading: !!genreItems[index]?.isLoading,
    })),
    ...(discoverGenre ? [{ id: `discover-${discoverGenre}`, kind: 'discover' as const, genre: discoverGenre, items: fresh(discover.data), loading: discover.isLoading }] : []),
    { id: 'new', kind: 'new', items: fresh(latest.data), loading: latest.isLoading },
  ]

  // ---- hero: some of what you're watching, plus something new ----
  const spotlight = useSpotlightPool(api, userId)
  const featured = featuredMix(continueItems, spotlight.data ?? [], `${userId}:${spotlightSlot()}`)

  return {
    rows,
    featured,
    loading: continueLoading || spotlight.isLoading,
  }
}
