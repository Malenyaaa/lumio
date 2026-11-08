import { Navigate, useParams } from 'react-router'
import { ItemGrid } from '@/components/media/item-grid'
import { useItem, useLibrary, useLibraryGenres } from '@/features/items/queries'
import { useMessages } from '@/lib/i18n'
import { LibraryToolbar, useLibraryQuery } from './library-toolbar'
import { libraryMessages } from './messages'

export function LibraryPage() {
  const { id = '' } = useParams()
  const t = useMessages(libraryMessages)
  const view = useItem(id)
  const collectionType = view.data?.CollectionType ?? undefined
  const [query, setQuery] = useLibraryQuery()
  const library = useLibrary(id, collectionType, view.isSuccess, query)
  const genres = useLibraryGenres(id, collectionType, view.isSuccess)

  if (view.isError) return <Navigate to="/" replace />

  const items = library.data?.pages.flatMap((page) => page.items) ?? []
  const total = library.data?.pages[0]?.total
  const narrowed = query.genreIds.length > 0 || query.filters.length > 0 || query.search !== ''

  return (
    <div className="space-y-6 px-4 pb-8 pt-20 sm:px-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{view.data?.Name}</h1>
        {total != null && <span className="text-sm text-muted-foreground">{t.count(total)}</span>}
      </div>
      <LibraryToolbar query={query} onChange={setQuery} genres={genres.data ?? []} />
      <div className={library.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <ItemGrid
          items={items}
          loading={view.isLoading || library.isLoading}
          hasMore={library.hasNextPage && !library.isPlaceholderData}
          loadingMore={library.isFetchingNextPage}
          onLoadMore={() => void library.fetchNextPage({ cancelRefetch: false })}
        />
      </div>
      {library.isSuccess && !library.isPlaceholderData && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{narrowed ? t.noMatches : t.empty}</p>
      )}
    </div>
  )
}
