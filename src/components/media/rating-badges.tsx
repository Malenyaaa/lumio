import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconExternalLink, IconStarFilled } from '@tabler/icons-react'
import { formatRating } from '@/lib/format'
import { useMessages } from '@/lib/i18n'
import { tmdbUrl, useTmdbRating, type TmdbKind } from '@/lib/tmdb'
import { ratingMessages } from './messages'
import { TomatoIcon } from './tomato-icon'

const chip = 'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium'

/** Ratings are plain info; where to read more lives in <ExternalLinks>. */
export function RatingBadges({ item }: { item: BaseItemDto }) {
  const tmdbId = item.ProviderIds?.Tmdb ?? undefined
  const kind: TmdbKind | undefined = item.Type === 'Movie' ? 'movie' : item.Type === 'Series' ? 'tv' : undefined
  const tmdb = useTmdbRating(kind, tmdbId)
  const t = useMessages(ratingMessages)

  const fromTmdb = tmdb.data != null
  const rating = tmdb.data ?? item.CommunityRating

  if (!rating && !item.CriticRating) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!!rating && (
        <span className={chip} title={fromTmdb ? t.tmdbRating : t.communityRating}>
          <IconStarFilled className="size-3.5 text-yellow-400" />
          {fromTmdb && <span className="text-muted-foreground">TMDB</span>}
          {formatRating(rating)}
        </span>
      )}
      {/* Jellyfin's critic rating is the Rotten Tomatoes Tomatometer (as jellyfin-web shows it). */}
      {!!item.CriticRating && (
        <span className={chip} title={t.tomatometer}>
          <TomatoIcon fresh={item.CriticRating >= 60} className="size-3.5" />
          {Math.round(item.CriticRating)}%
        </span>
      )}
    </div>
  )
}

interface ExternalLink {
  label: string
  href: string
}

/** External URLs come from metadata providers and plugins: never render a javascript: or data: link from them. */
function isWebUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function externalLinks(item: BaseItemDto): ExternalLink[] {
  const ids = item.ProviderIds ?? {}
  const links: ExternalLink[] = []
  if (item.Type === 'Person') {
    if (ids.Imdb) links.push({ label: 'IMDb', href: `https://www.imdb.com/name/${ids.Imdb}/` })
    if (ids.Tmdb) links.push({ label: 'TMDB', href: `https://www.themoviedb.org/person/${ids.Tmdb}` })
    return links
  }
  const tmdbKind = item.Type === 'Movie' ? 'movie' : item.Type === 'Series' ? 'tv' : undefined
  if (ids.Imdb) links.push({ label: 'IMDb', href: `https://www.imdb.com/title/${ids.Imdb}/` })
  if (ids.Tmdb && tmdbKind) links.push({ label: 'TMDB', href: tmdbUrl(tmdbKind, ids.Tmdb) })
  if (ids.Tvdb && item.Type === 'Series') links.push({ label: 'TheTVDB', href: `https://thetvdb.com/dereferrer/series/${ids.Tvdb}` })
  if (ids.AniList) links.push({ label: 'AniList', href: `https://anilist.co/anime/${ids.AniList}` })
  if (ids.AniDB) links.push({ label: 'AniDB', href: `https://anidb.net/anime/${ids.AniDB}` })
  for (const url of item.ExternalUrls ?? []) {
    if (url.Url && url.Name && isWebUrl(url.Url) && !links.some((link) => link.href === url.Url) && !links.some((link) => link.label.toLowerCase() === url.Name!.toLowerCase())) {
      links.push({ label: url.Name, href: url.Url })
    }
  }
  return links
}

/** Outbound links to the item's pages on other sites; the external-link icon appears on hover/focus. */
export function ExternalLinks({ item }: { item: BaseItemDto }) {
  const links = externalLinks(item)
  const t = useMessages(ratingMessages)
  if (!links.length) return null

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      <span className="mr-1 text-xs text-muted-foreground">{t.moreOn}</span>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="group/link inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {link.label}
          <IconExternalLink className="size-3.5 w-0 opacity-0 transition-all group-hover/link:w-3.5 group-hover/link:opacity-100 group-focus-visible/link:w-3.5 group-focus-visible/link:opacity-100" />
        </a>
      ))}
    </div>
  )
}
