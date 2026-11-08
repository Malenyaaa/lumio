import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { FadeImage } from '@/components/media/fade-image'
import { MediaRow } from '@/components/media/media-row'
import { ExternalLinks } from '@/components/media/rating-badges'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthedSession } from '@/features/auth/session'
import { useItem, usePersonItems } from '@/features/items/queries'
import { plainText } from '@/lib/format'
import { getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { personMessages } from './messages'

/** Fixed at load: ages only change at midnight, which isn't worth a render-time clock. */
const NOW = new Date()

function ageAt(born: Date, until: Date) {
  let age = until.getFullYear() - born.getFullYear()
  const birthdayPassed = until.getMonth() > born.getMonth() || (until.getMonth() === born.getMonth() && until.getDate() >= born.getDate())
  if (!birthdayPassed) age -= 1
  return age
}

const COLLAPSED_LENGTH = 600

/** Long biographies are cut off with a "read more" toggle. */
function Biography({ text }: { text: string }) {
  const t = useMessages(personMessages)
  const [expanded, setExpanded] = useState(false)
  const long = text.length > COLLAPSED_LENGTH
  return (
    <div className="max-w-3xl space-y-2">
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {long && !expanded ? `${text.slice(0, COLLAPSED_LENGTH).trimEnd()} …` : text}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((open) => !open)} className="text-sm font-medium underline-offset-4 hover:underline">
          {expanded ? t.showLess : t.readMore}
        </button>
      )}
    </div>
  )
}

export function PersonPage() {
  const { id = '' } = useParams()
  const { api } = useAuthedSession()
  const t = useMessages(personMessages)
  const localeTag = getLocaleTag(useLocale())
  const person = useItem(id)
  const credits = usePersonItems(id)

  const data = person.data
  const photo = data ? portraitImageUrl(api, data, { fillHeight: 600 }) : undefined
  const biography = plainText(data?.Overview)

  const facts = useMemo(() => {
    if (!data?.PremiereDate) return []
    const born = new Date(data.PremiereDate)
    const died = data.EndDate ? new Date(data.EndDate) : undefined
    const age = ageAt(born, died ?? NOW)
    const dateFormat = new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'long', year: 'numeric' })
    return [
      died ? t.born(dateFormat.format(born)) : t.bornWithAge(dateFormat.format(born), age),
      died ? t.died(dateFormat.format(died), age) : undefined,
      data.ProductionLocations?.[0],
    ].filter(Boolean) as string[]
  }, [data, t, localeTag])

  const byType = (type: string) => credits.data?.filter((item) => item.Type === type)

  return (
    <div className="space-y-10 pb-12 pt-20">
      <header className="flex flex-col items-start gap-6 px-4 sm:flex-row sm:px-8">
        <div className="aspect-[2/3] w-40 shrink-0 self-start overflow-hidden rounded-lg bg-muted ring-1 ring-border sm:w-56">
          {photo && <FadeImage src={photo} alt="" className="size-full object-cover" />}
          {person.isLoading && <Skeleton className="size-full" />}
        </div>
        <div className="min-w-0 space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">{data?.Name}</h1>
          {facts.length > 0 && (
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          )}
          {biography && <Biography text={biography} />}
          {data && <ExternalLinks item={data} />}
        </div>
      </header>

      <div className="space-y-10">
        <MediaRow title={t.movies} items={byType('Movie')} loading={credits.isLoading} />
        <MediaRow title={t.series} items={byType('Series')} />
        <MediaRow title={t.episodes} items={byType('Episode')} shape="landscape" />
        {credits.isSuccess && credits.data.length === 0 && (
          <p className="px-4 text-sm text-muted-foreground sm:px-8">{t.noTitles}</p>
        )}
      </div>
    </div>
  )
}
