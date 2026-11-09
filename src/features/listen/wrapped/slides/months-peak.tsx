import { defineMessages, useMessages } from '@/lib/i18n'
import { accentText, Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Dein lautester Monat', more: (minutes: string, percent: number) => `${minutes} Minuten · ${percent} % mehr als in einem üblichen Monat` },
  en: { lead: 'Your loudest month', more: (minutes: string, percent: number) => `${minutes} minutes · ${percent}% more than a usual month` },
})

/** The busiest month huge and skewed, the twelve months as a strip of bars under it. */
export default {
  id: 'months-peak',
  topic: 'months',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number, month, shortMonth } = useFormats()
    const max = Math.max(1, ...data.months)
    const peak = data.months.indexOf(max)
    const average = data.months.reduce((sum, value) => sum + value, 0) / 12
    return (
      <Body className="justify-center gap-6">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <In delay={200} from="left">
          <Headline look={look} className="-skew-y-3 text-[clamp(2.4rem,13vw,4rem)] sm:text-6xl">
            <span style={{ color: accentText(palette) }}>{month.format(new Date(Date.UTC(data.year, peak, 1)))}</span>
          </Headline>
        </In>
        <In delay={500}>
          <p className="text-lg font-semibold">{t.more(number.format(max), Math.max(0, Math.round((max / average - 1) * 100)))}</p>
        </In>
        <div className="mt-4 grid grid-cols-12 items-end gap-1" aria-hidden>
          {data.months.map((minutes, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end">
                <div
                  className="wrapped-grow w-full rounded-t"
                  style={{ height: `${Math.max(4, (minutes / max) * 100)}%`, background: index === peak ? palette.accent : 'currentColor', opacity: index === peak ? 1 : 0.35, animationDelay: `${700 + index * 60}ms` }}
                />
              </div>
              <span className="text-[10px] font-bold uppercase">{shortMonth.format(new Date(Date.UTC(data.year, index, 1))).slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
