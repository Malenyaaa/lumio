import { useQuery } from '@tanstack/react-query'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY

export type TmdbKind = 'movie' | 'tv'

export function tmdbUrl(kind: TmdbKind, id: string) {
  return `https://www.themoviedb.org/${kind}/${id}`
}

/** TMDB's own average rating; stays disabled (and the UI falls back to Jellyfin's rating) without an API key. */
export function useTmdbRating(kind: TmdbKind | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ['tmdb-rating', kind, id],
    enabled: !!API_KEY && !!kind && !!id,
    staleTime: 24 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`https://api.themoviedb.org/3/${kind}/${id}?api_key=${API_KEY}`)
      if (!response.ok) throw new Error(`TMDB ${response.status}`)
      const data = (await response.json()) as { vote_average?: number; vote_count?: number }
      return data.vote_count ? (data.vote_average ?? null) : null
    },
  })
}
