import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Du hast dieses Jahr',
    unit: 'Minuten Musik gehört.',
    more: (percent: number, year: number) => `${percent} % mehr als ${year}.`,
    less: (percent: number, year: number) => `${percent} % weniger als ${year}.`,
    same: (year: number) => `Fast genauso viel wie ${year}.`,
  },
  en: {
    lead: 'This year you listened to',
    unit: 'minutes of music.',
    more: (percent: number, year: number) => `${percent}% more than in ${year}.`,
    less: (percent: number, year: number) => `${percent}% less than in ${year}.`,
    same: (year: number) => `About as much as in ${year}.`,
  },
})

/** The minutes counting up over drifting color blobs, the change to the year before below. */
export default {
  id: 'minutes-counter',
  topic: 'minutes',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const minutes = useCountUp(data.minutes, active, 1800, 300)
    const change = data.previousMinutes ? Math.round(((data.minutes - data.previousMinutes) / data.previousMinutes) * 100) : null
    return (
      <>
        <div aria-hidden className="wrapped-blob absolute -top-10 -left-16 size-72 rounded-full opacity-70" style={{ background: palette.accent }} />
        <div aria-hidden className="wrapped-blob absolute right-[-30%] bottom-10 size-80 rounded-full opacity-50 [animation-delay:-6s]" style={{ background: palette.accent }} />
        <Body className="justify-center gap-4">
          <In>
            <p className="text-2xl font-bold">{t.lead}</p>
          </In>
          <Headline look={look} className="text-7xl tabular-nums sm:text-8xl">
            {number.format(minutes)}
          </Headline>
          <In delay={250}>
            <p className="text-2xl font-bold">{t.unit}</p>
          </In>
          {change !== null && (
            <In delay={1900}>
              <p className="mt-6 inline-block rounded-full bg-black/25 px-4 py-2 text-lg font-bold">
                {Math.abs(change) < 3 ? t.same(data.year - 1) : change > 0 ? t.more(change, data.year - 1) : t.less(-change, data.year - 1)}
              </p>
            </In>
          )}
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
