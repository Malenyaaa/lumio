import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, inHours, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Minuten. So viel Musik war es.',
    hours: (hours: string, days: string) => `Das sind ${hours} Stunden, oder ${days} Tage am Stück.`,
  },
  en: {
    lead: 'minutes. That much music.',
    hours: (hours: string, days: string) => `That’s ${hours} hours, or ${days} days straight.`,
  },
})

const BANDS = ['#f774c2', '#ff8a1e', '#6a00ba', '#111111', '#12d861']

/** The number five times, each on a band of its own color, the outer ones cut off (2022). */
export default {
  id: 'minutes-stacked-bands',
  topic: 'minutes',
  Component: ({ data }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const { hours, days } = inHours(data.minutes)
    const value = number.format(data.minutes)
    return (
      <Body className="justify-center gap-6 px-0">
        <div className="-mx-2 overflow-hidden">
          {BANDS.map((color, index) => (
            <div
              key={color}
              className={index % 2 ? 'wrapped-slab-right' : 'wrapped-slab-left'}
              style={{ background: color, color: index === 4 ? '#111' : '#fff', animationDelay: `${index * 110}ms` }}
            >
              <p className="text-center font-[Archivo_Black] text-[5.2rem] leading-[0.82] tabular-nums tracking-tighter" style={{ marginTop: index === 0 ? '-0.32em' : 0, marginBottom: index === 4 ? '-0.3em' : 0 }}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <In delay={800} className="space-y-2 px-7">
          <p className="text-2xl font-extrabold">{t.lead}</p>
          <p className="text-lg font-semibold">{t.hours(number.format(hours), number.format(days))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
