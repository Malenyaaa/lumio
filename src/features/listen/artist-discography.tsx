import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconChevronDown, IconSearch, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Link } from '@/components/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useArtistAlbums, useItem } from '@/features/items/queries'
import { defineMessages, useMessages } from '@/lib/i18n'
import { titlePath } from '@/lib/item-links'
import { useArtistTracks } from './artist-page'
import { MusicCard } from './music-card'

const messages = defineMessages({
  de: {
    all: 'Alle',
    albums: 'Alben',
    singles: 'Singles und EPs',
    show: 'Anzeigen',
    sortBy: 'Sortieren nach',
    newest: 'Veröffentlichungsdatum',
    oldest: 'Älteste zuerst',
    name: 'Alphabetisch',
    popular: 'Beliebtheit',
    search: 'In der Diskografie suchen',
    clearSearch: 'Suche leeren',
    nothing: 'Keine Veröffentlichungen gefunden.',
    album: 'Album',
    single: 'Single',
    ep: 'EP',
  },
  en: {
    all: 'All',
    albums: 'Albums',
    singles: 'Singles and EPs',
    show: 'Show',
    sortBy: 'Sort by',
    newest: 'Release date',
    oldest: 'Oldest first',
    name: 'Alphabetical',
    popular: 'Popularity',
    search: 'Search in discography',
    clearSearch: 'Clear search',
    nothing: 'No releases found.',
    album: 'Album',
    single: 'Single',
    ep: 'EP',
  },
})

/** A release's kind as Spotify names it: a single up to three tracks, an EP up to six, an album beyond that. */
export function releaseKind(album: BaseItemDto, tracks: BaseItemDto[]): 'single' | 'ep' | 'album' {
  const count = album.ChildCount ?? tracks.filter((track) => track.AlbumId === album.Id).length
  return count > 6 ? 'album' : count > 3 ? 'ep' : 'single'
}

/** "2024 • Single", the line under a release on an artist's pages. */
export function useReleaseLine() {
  const t = useMessages(messages)
  return (album: BaseItemDto, tracks: BaseItemDto[]) => [album.ProductionYear, t[releaseKind(album, tracks)]].filter(Boolean).join(' • ')
}

type Filter = 'all' | 'albums' | 'singles'
type Sort = 'newest' | 'oldest' | 'name' | 'popular'

/** All of an artist's releases, as Spotify's "Show all": filter by kind, search by name, sort. */
export function ArtistDiscographyPage() {
  const { id = '' } = useParams()
  const t = useMessages(messages)
  const artist = useItem(id).data
  const albums = useArtistAlbums(id)
  const tracks = useArtistTracks(id).data ?? []
  const line = useReleaseLine()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')

  const term = query.trim().toLocaleLowerCase()
  const plays = (album: BaseItemDto) => tracks.filter((track) => track.AlbumId === album.Id).reduce((sum, track) => sum + (track.UserData?.PlayCount ?? 0), 0)
  const released = (album: BaseItemDto) => Date.parse(album.PremiereDate ?? '') || (album.ProductionYear ? Date.UTC(album.ProductionYear, 0) : 0)
  const shown = (albums.data?.albums ?? [])
    .filter((album) => {
      const kind = releaseKind(album, tracks)
      if (filter === 'albums' && kind !== 'album') return false
      if (filter === 'singles' && kind === 'album') return false
      return !term || (album.Name ?? '').toLocaleLowerCase().includes(term)
    })
    .sort((a, b) => {
      if (sort === 'name') return (a.SortName ?? a.Name ?? '').localeCompare(b.SortName ?? b.Name ?? '')
      if (sort === 'popular') return plays(b) - plays(a) || released(b) - released(a)
      return (released(b) - released(a)) * (sort === 'oldest' ? -1 : 1)
    })
  const filters: Record<Filter, string> = { all: t.all, albums: t.albums, singles: t.singles }
  const sorts: Record<Sort, string> = { newest: t.newest, oldest: t.oldest, name: t.name, popular: t.popular }
  const trigger = 'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground outline-none hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="space-y-4 pb-12 pt-20">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8">
        <h1 className="mr-auto min-w-0 truncate text-2xl font-extrabold tracking-tight">
          {artist ? (
            <Link to={titlePath('MusicArtist', id)} className="hover:underline">
              {artist.Name}
            </Link>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </h1>
        <div className="flex items-center gap-1">
          {searching ? (
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                aria-label={t.search}
                placeholder={t.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && (setQuery(''), setSearching(false))}
                className="h-8 w-44 pl-8 pr-8 sm:w-60"
              />
              <button
                type="button"
                aria-label={t.clearSearch}
                onClick={() => {
                  setQuery('')
                  setSearching(false)
                }}
                className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={t.search}
              title={t.search}
              onClick={() => setSearching(true)}
              className="grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-foreground/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconSearch className="size-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className={trigger}>
              {filters[filter]} <IconChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* A label belongs inside its group (Base UI). */}
              <DropdownMenuRadioGroup value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                <DropdownMenuLabel>{t.show}</DropdownMenuLabel>
                {(Object.keys(filters) as Filter[]).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {filters[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={trigger}>
              {sorts[sort]} <IconChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* A label belongs inside its group (Base UI). */}
              <DropdownMenuRadioGroup value={sort} onValueChange={(value) => setSort(value as Sort)}>
                <DropdownMenuLabel>{t.sortBy}</DropdownMenuLabel>
                {(Object.keys(sorts) as Sort[]).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {sorts[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] px-1 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:px-5">
        {albums.isLoading && Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="m-3 aspect-square rounded-md" />)}
        {shown.map((album) => (
          <MusicCard key={album.Id} item={album} subtitle={line(album, tracks)} className="w-auto" />
        ))}
      </div>
      {!albums.isLoading && !shown.length && <p className="px-4 text-sm text-muted-foreground sm:px-8">{t.nothing}</p>}
    </div>
  )
}
