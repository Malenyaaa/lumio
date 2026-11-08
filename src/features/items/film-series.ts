import { BaseItemKind, ItemFields, ItemSortBy, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { getLocale } from '@/lib/i18n'
import { relayFetch } from '@/features/social/social'
import { hasService, ownKey } from '@/lib/services'

/**
 * Film series ("Harry Potter", "Kung Fu Panda"): Jellyfin stores the TMDB collection a film belongs to as the provider
 * id `TmdbCollection`, even when no Jellyfin collection (BoxSet) exists. Films sharing it form the series, in release
 * order. Its name comes from TMDB when an API key is configured, otherwise from what the titles have in common.
 */
export interface FilmSeries {
  id: string
  name: string
  films: BaseItemDto[]
  /** Position of the asked-for film, 0-based. */
  index: number
}


/** All films with their collection id, in one light request; cached for a while (series rarely change). */
function useFilmsByCollection() {
  const { api, session } = useAuthedSession()
  return useQuery({
    queryKey: ['film-collections', session.userId],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const films =
        (
          await getLibraryApi(api).getItems({
            userId: session.userId,
            recursive: true,
            includeItemTypes: [BaseItemKind.Movie],
            fields: [ItemFields.ProviderIds, ItemFields.PrimaryImageAspectRatio],
            sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName],
          })
        ).data.Items ?? []
      const byCollection = new Map<string, BaseItemDto[]>()
      for (const film of films) {
        const collection = film.ProviderIds?.TmdbCollection
        if (!collection) continue
        byCollection.set(collection, [...(byCollection.get(collection) ?? []), film])
      }
      return byCollection
    },
  })
}

/** Words a series title shouldn't end with ("Harry Potter und …" → "Harry Potter"). */
const TRAILING = /[\s:–—\-&,.]+$|\s+(und|and|the|der|die|das|des|of|im|in|von|vs\.?|&)$/i

/** What the titles of a series have in common, e.g. "Kung Fu Panda" from "Kung Fu Panda" and "Kung Fu Panda 2". */
function commonName(films: BaseItemDto[]): string {
  const titles = films.map((film) => (film.Name ?? '').split(/\s+/))
  const shared: string[] = []
  for (let i = 0; i < titles[0]!.length; i++) {
    const word = titles[0]![i]!
    if (!titles.every((words) => words[i]?.toLowerCase() === word.toLowerCase())) break
    shared.push(word)
  }
  let name = shared.join(' ')
  // Strip connecting words and punctuation left at the end, repeatedly ("Asterix & Obelix -" → "Asterix & Obelix").
  for (let previous = ''; previous !== name; ) {
    previous = name
    name = name.replace(TRAILING, '').trim()
  }
  return name || films[0]?.Name || ''
}

/** The series a film belongs to (only when the library has at least two of its films). */
export function useFilmSeries(item: BaseItemDto | undefined): FilmSeries | undefined {
  const collections = useFilmsByCollection()
  const id = item?.Type === 'Movie' ? (item.ProviderIds?.TmdbCollection ?? undefined) : undefined
  const films = id ? collections.data?.get(id) : undefined
  const enabled = !!id && !!films && films.length > 1

  const tmdbName = useQuery({
    queryKey: ['tmdb-collection', id, getLocale()],
    enabled: enabled && hasService('tmdb'),
    staleTime: 24 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const language = getLocale() === 'de' ? 'de-DE' : 'en-US'
      const key = ownKey('tmdb')
      const response = await relayFetch('tmdb', `collection/${id}`, new URLSearchParams({ ...(key ? { api_key: key } : {}), language }), 'https://api.themoviedb.org/3/')
      if (!response.ok) throw new Error(`TMDB ${response.status}`)
      // TMDB names them "Harry Potter Filmreihe" / "Harry Potter Collection"; the UI adds its own word for it.
      return ((await response.json()) as { name?: string }).name?.replace(/\s*(Filmreihe|Collection|Sammlung|Reihe)$/i, '')
    },
  })

  if (!enabled || !id || !films) return undefined
  return { id, name: tmdbName.data || commonName(films), films, index: Math.max(0, films.findIndex((film) => film.Id === item?.Id)) }
}
