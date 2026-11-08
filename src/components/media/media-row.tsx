import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MediaCard, type CardShape } from './media-card'
import { ScrollRow } from './scroll-row'

interface MediaRowProps {
  title: string
  items?: BaseItemDto[]
  loading?: boolean
  shape?: CardShape
  /** Marks one card, e.g. the film you are looking at within its series. */
  currentId?: string
  /** Loading placeholders as squares (music covers) instead of the shape's own. */
  squareLoading?: boolean
}

export function MediaRow({ title, items, loading, shape = 'poster', currentId, squareLoading }: MediaRowProps) {
  if (!loading && !items?.length) return null

  return (
    <section className="space-y-3">
      <h2 className="px-4 text-lg font-semibold tracking-tight sm:px-8">{title}</h2>
      <ScrollRow className="gap-4 px-4 pb-2 sm:px-8" restoreKey={loading ? undefined : title}>
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  'shrink-0 rounded-lg',
                  squareLoading ? 'aspect-square w-36 sm:w-40 lg:w-44' : shape === 'poster' ? 'aspect-[2/3] w-36 sm:w-40 lg:w-44' : 'aspect-video w-64 sm:w-72',
                )}
              />
            ))
          : items!.map((item) => <MediaCard key={item.Id} item={item} shape={shape} current={item.Id === currentId} />)}
      </ScrollRow>
    </section>
  )
}
