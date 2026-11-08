import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconCheck } from '@tabler/icons-react'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { watchedMessages } from './messages'

const base = 'grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold shadow ring-1 ring-black/20'

/** Corner badge: a check once watched, or the number of unwatched episodes for a series. */
export function WatchedBadge({ item, className }: { item: BaseItemDto; className?: string }) {
  const data = item.UserData
  const t = useMessages(watchedMessages)
  if (!data) return null

  if (data.Played) {
    return (
      <span role="img" aria-label={t.watched} title={t.watched} className={cn(base, 'bg-primary text-primary-foreground', className)}>
        <IconCheck className="size-3.5" stroke={3} />
      </span>
    )
  }
  const unplayed = data.UnplayedItemCount
  if (unplayed && (item.Type === 'Series' || item.Type === 'Season' || item.Type === 'BoxSet')) {
    return (
      <span
        role="img"
        aria-label={t.unwatched(unplayed)}
        title={t.unwatched(unplayed)}
        className={cn(base, 'bg-black/70 text-white backdrop-blur', className)}
      >
        {unplayed}
      </span>
    )
  }
  return null
}
