import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconAdjustmentsHorizontal, IconArrowsSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ExpandingSearch } from '@/components/expanding-search'
import { ScrollRow } from '@/components/media/scroll-row'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LibraryFilter, LibraryQuery, LibrarySort } from '@/features/items/queries'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { toolbarMessages } from './messages'

// Labels come from `toolbarMessages`, keyed by the value.
const SORTS: Array<{ value: LibrarySort; descending: boolean }> = [
  { value: 'name', descending: false },
  { value: 'added', descending: true },
  { value: 'released', descending: true },
  { value: 'rating', descending: true },
  { value: 'critics', descending: true },
  { value: 'runtime', descending: false },
  { value: 'random', descending: false },
]

const FILTERS: LibraryFilter[] = ['unplayed', 'played', 'favorite']

const SEARCH_DEBOUNCE_MS = 300

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : [])

/** Sort, filters and search of the library page, kept in the URL so they survive reloads and the back button. */
export function useLibraryQuery(): [LibraryQuery, (patch: Partial<LibraryQuery>) => void] {
  const [params, setParams] = useSearchParams()
  const sortParam = params.get('sort')
  const sort = SORTS.find((option) => option.value === sortParam) ?? SORTS[0]!
  const order = params.get('order')
  const genre = params.get('genre')
  const filter = params.get('filter')
  const search = params.get('q') ?? ''

  const query = useMemo<LibraryQuery>(
    () => ({
      sort: sort.value,
      descending: order ? order === 'desc' : sort.descending,
      genreIds: list(genre),
      filters: list(filter).filter((value): value is LibraryFilter => FILTERS.includes(value as LibraryFilter)),
      search,
    }),
    [sort, order, genre, filter, search],
  )

  const update = (patch: Partial<LibraryQuery>) => {
    const next = { ...query, ...patch }
    const defaults = SORTS.find((option) => option.value === next.sort)!
    const entries: Record<string, string> = {}
    if (next.sort !== 'name') entries.sort = next.sort
    if (next.descending !== defaults.descending) entries.order = next.descending ? 'desc' : 'asc'
    if (next.genreIds.length) entries.genre = next.genreIds.join(',')
    if (next.filters.length) entries.filter = next.filters.join(',')
    if (next.search) entries.q = next.search
    // The library chosen within a category is part of the page, not of the query: keep it.
    const library = params.get('lib')
    if (library) entries.lib = library
    setParams(entries, { replace: true, preventScrollReset: true })
  }

  return [query, update]
}

interface LibraryToolbarProps {
  query: LibraryQuery
  onChange: (patch: Partial<LibraryQuery>) => void
  genres: BaseItemDto[]
}

export function LibraryToolbar({ query, onChange, genres }: LibraryToolbarProps) {
  const t = useMessages(toolbarMessages)
  const currentSort = SORTS.find((option) => option.value === query.sort)!

  // The field updates at once, the URL (and with it the query) after a pause in typing.
  const [search, setSearch] = useState(query.search)
  const [seenSearch, setSeenSearch] = useState(query.search)
  if (seenSearch !== query.search) {
    setSeenSearch(query.search)
    if (search.trim() !== query.search) setSearch(query.search)
  }
  useEffect(() => {
    if (search.trim() === query.search) return
    const timer = window.setTimeout(() => onChange({ search: search.trim() }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  })

  const toggleGenre = (id: string) =>
    onChange({ genreIds: query.genreIds.includes(id) ? query.genreIds.filter((genre) => genre !== id) : [...query.genreIds, id] })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <IconArrowsSort />
            {t[currentSort.value]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.sortBy}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={query.sort}
                onValueChange={(value) => {
                  const option = SORTS.find((entry) => entry.value === value)
                  // Each order starts in its natural direction: newest, best rated, A–Z.
                  if (option) onChange({ sort: option.value, descending: option.descending })
                }}
              >
                {SORTS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {t[option.value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {query.sort !== 'random' && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={query.descending ? t.sortedDescending : t.sortedAscending}
            title={query.descending ? t.descending : t.ascending}
            onClick={() => onChange({ descending: !query.descending })}
          >
            {query.descending ? <IconSortDescending /> : <IconSortAscending />}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant={query.filters.length ? 'secondary' : 'outline'} size="sm" />}>
            <IconAdjustmentsHorizontal />
            {t.filter}
            {query.filters.length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{query.filters.length}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.show}</DropdownMenuLabel>
              {FILTERS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={query.filters.includes(option)}
                  onCheckedChange={(checked) =>
                    onChange({ filters: checked ? [...query.filters, option] : query.filters.filter((value) => value !== option) })
                  }
                >
                  {t[option]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {(query.filters.length > 0 || query.genreIds.length > 0) && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange({ filters: [], genreIds: [] })}>
            {t.reset}
          </Button>
        )}

        <ExpandingSearch value={search} onChange={setSearch} label={t.search} className="ml-auto" />
      </div>

      {genres.length > 0 && (
        <ScrollRow className="-mx-1 gap-2 px-1 py-1">
          <GenreChip selected={query.genreIds.length === 0} onClick={() => onChange({ genreIds: [] })}>
            {t.allGenres}
          </GenreChip>
          {genres.map((genre) => (
            <GenreChip key={genre.Id} selected={query.genreIds.includes(genre.Id!)} onClick={() => toggleGenre(genre.Id!)}>
              {genre.Name}
            </GenreChip>
          ))}
        </ScrollRow>
      )}
    </div>
  )
}

function GenreChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string | null | undefined }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-transparent bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
