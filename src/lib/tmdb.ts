import { useQuery } from '@tanstack/react-query'
import { relayFetch } from '@/features/social/social'
import { hasService, ownKey } from './services'


export type TmdbKind = 'movie' | 'tv'

export function tmdbUrl(kind: TmdbKind, id: string) {
  return `https://www.themoviedb.org/${kind}/${id}`
}

/** TMDB's own average rating; stays disabled (and the UI falls back to Jellyfin's rating) without a key. */
export function useTmdbRating(kind: TmdbKind | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ['tmdb-rating', kind, id],
    enabled: hasService('tmdb') && !!kind && !!id,
    staleTime: 24 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const key = ownKey('tmdb')
      // Through the Lumio server (its key, cached for everyone); with the app's own key, straight from TMDb otherwise.
      const response = await relayFetch('tmdb', `${kind}/${id}`, new URLSearchParams(key ? { api_key: key } : {}), 'https://api.themoviedb.org/3/')
      if (!response.ok) throw new Error(`TMDB ${response.status}`)
      const data = (await response.json()) as { vote_average?: number; vote_count?: number }
      return data.vote_count ? (data.vote_average ?? null) : null
    },
  })
}
