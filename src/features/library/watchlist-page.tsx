import { IconBookmark } from '@tabler/icons-react'
import { ItemGrid } from '@/components/media/item-grid'
import { useFavorites } from '@/features/items/queries'
import { useMessages } from '@/lib/i18n'
import { watchlistMessages } from './messages'

export function WatchlistPage() {
  const t = useMessages(watchlistMessages)
  const favorites = useFavorites()
  const items = favorites.data ?? []

  return (
    <div className="space-y-6 px-4 pb-8 pt-20 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      {!favorites.isLoading && items.length === 0 ? (
        <div className="grid place-items-center gap-3 py-24 text-center text-muted-foreground">
          <IconBookmark className="size-8" />
          <p className="max-w-sm text-sm">{t.empty}</p>
        </div>
      ) : (
        <ItemGrid items={items} loading={favorites.isLoading} />
      )}
    </div>
  )
}
