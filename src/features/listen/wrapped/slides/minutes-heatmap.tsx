import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { minutes: (value: string) => `${value} Minuten`, days: (active: number, all: number) => `An ${active} von ${all} Tagen lief Musik.` },
  en: { minutes: (value: string) => `${value} minutes`, days: (active: number, all: number) => `Music played on ${active} of ${all} days.` },
})

/** Every day of the year as a square, brighter the more was played: the year at a glance. */
export default {
  id: 'minutes-heatmap',
  topic: 'minutes',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const max = Math.max(1, ...data.daily)
    // Weeks as columns (Monday on top), as a contribution calendar.
    const offset = (new Date(Date.UTC(data.year, 0, 1)).getUTCDay() + 6) % 7
    return (
      <Body className="justify-center gap-6">
        <In>
          <Headline look={look} className="text-5xl tabular-nums">
            {t.minutes(number.format(data.minutes))}
          </Headline>
        </In>
        <div className="grid grid-flow-col grid-rows-7 gap-[2px]" aria-hidden>
          {Array.from({ length: offset }, (_, index) => (
            <span key={`pad${index}`} />
          ))}
          {data.daily.map((minutes, index) => (
            <span
              key={index}
              className="aspect-square animate-in fade-in-0 zoom-in-50 rounded-[2px] fill-mode-both"
              style={{
                background: minutes ? palette.accent : 'currentColor',
                opacity: minutes ? 0.25 + 0.75 * Math.sqrt(minutes / max) : 0.12,
                animationDelay: `${200 + index * 4}ms`,
                animationDuration: '400ms',
              }}
            />
          ))}
        </div>
        <In delay={1800}>
          <p className="text-xl font-bold">{t.days(data.activeDays, data.daily.length)}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
