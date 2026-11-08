import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models'
import { Skeleton } from '@/components/ui/skeleton'
import { PersonCard } from './person-card'
import { ScrollRow } from './scroll-row'

interface PersonRowProps {
  title: string
  people: Array<{ person: BaseItemPerson; subtitle?: string }>
  /** Show placeholders instead of hiding the row while the people are still being fetched. */
  loading?: boolean
}

export function PersonRow({ title, people, loading }: PersonRowProps) {
  if (!loading && !people.length) return null
  return (
    <section className="space-y-3">
      <h2 className="px-4 text-lg font-semibold tracking-tight sm:px-8">{title}</h2>
      <ScrollRow className="gap-3 px-3 pb-2 sm:px-7" restoreKey={loading ? undefined : title}>
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex w-28 shrink-0 flex-col items-center gap-2 p-1 sm:w-32">
                <Skeleton className="size-24 rounded-full sm:size-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))
          : people.map(({ person, subtitle }, index) => <PersonCard key={`${person.Id}-${index}`} person={person} subtitle={subtitle} />)}
      </ScrollRow>
    </section>
  )
}
