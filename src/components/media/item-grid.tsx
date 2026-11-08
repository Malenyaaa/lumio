import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadMoreSentinel } from './load-more-sentinel'
import { MediaCard } from './media-card'

interface ItemGridProps {
  items: BaseItemDto[]
  loading?: boolean
  /** Infinite scroll: called when the end of the grid comes into view. */
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]'

export function ItemGrid({ items, loading, hasMore, loadingMore, onLoadMore }: ItemGridProps) {
  return (
    <>
      <div className={GRID}>
        {loading && Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-lg" />)}
        {items.map((item) => (
          <MediaCard key={item.Id} item={item} fluid />
        ))}
      </div>
      {hasMore && onLoadMore && <LoadMoreSentinel loading={loadingMore} onLoadMore={onLoadMore} />}
    </>
  )
}
