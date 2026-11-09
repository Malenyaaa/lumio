import { defineMessages, useMessages } from '@/lib/i18n'
import { accentText, Body, Headline, In, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'
import type { Wrapped } from '../wrapped-data'

const MULTIPLES = {
  de: ['', '', 'doppelt', 'dreimal', 'viermal', 'fünfmal'],
  en: ['', '', 'twice', 'three times', 'four times', 'five times'],
}

const messages = defineMessages({
  de: {
    lead: 'Da hat jemand aufgedreht',
    times: (times: number) => `${MULTIPLES.de[times] ?? `${times}-mal`} so viel`,
    asMuch: (year: number) => `Musik wie ${year}.`,
    more: (year: number) => `mehr Musik als ${year}.`,
    quip: 'Die Lautstärke kennt nur eine Richtung.',
    minutes: (value: string) => `${value} min`,
  },
  en: {
    lead: 'Someone turned it up',
    times: (times: number) => `${MULTIPLES.en[times] ?? `${times} times`} as much`,
    asMuch: (year: number) => `music as in ${year}.`,
    more: (year: number) => `more music than in ${year}.`,
    quip: 'The volume only goes one way.',
    minutes: (value: string) => `${value} min`,
  },
})

/** This year's minutes over last year's (0 without a year before worth comparing). */
function growth(data: Wrapped) {
  return data.previousMinutes && data.previousMinutes >= 600 ? data.minutes / data.previousMinutes : 0
}

/**
 * A year with far more music than the one before: two bars side by side, last year's and this year's, counting up,
 * and the jump as "+80 %" or "twice as much". For at least one and a half times the year before.
 */
export default {
  id: 'special-growth',
  topic: 'special',
  special: (data) => (growth(data) >= 1.5 ? Math.min(3, growth(data) / 1.5) : 0),
  after: 'minutes',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number, compact } = useFormats()
    const ratio = growth(data)
    const previous = data.previousMinutes ?? 0
    const percent = useCountUp(Math.round((ratio - 1) * 100), active, 1600, 900)
    const before = useCountUp(previous, active, 1200, 300)
    const now = useCountUp(data.minutes, active, 1800, 600)
    // Whole multiples read better from twice as much on ("doppelt so viel"), a percentage below.
    const times = Math.floor(ratio)
    const bars = [
      { year: data.year - 1, minutes: before, height: (previous / Math.max(1, data.minutes)) * 100, current: false },
      { year: data.year, minutes: now, height: 100, current: true },
    ]
    return (
      <Body className="justify-center gap-5">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <In delay={150}>
          <Headline look={look} className="text-[clamp(2.6rem,13vw,4rem)] tabular-nums">
            <span style={{ color: accentText(palette) }}>{times >= 2 ? t.times(times) : `+${number.format(percent)} %`}</span>
          </Headline>
          <p className="mt-2 text-xl font-bold">{times >= 2 ? t.asMuch(data.year - 1) : t.more(data.year - 1)}</p>
          <p className="mt-1 font-semibold opacity-80">{t.quip}</p>
        </In>
        <div className="mt-2 flex h-52 justify-center gap-6" aria-hidden>
          {bars.map((bar, index) => (
            <div key={bar.year} className="flex h-full w-28 flex-col items-center gap-2">
              <span className="text-sm font-bold tabular-nums">{t.minutes(compact.format(bar.minutes))}</span>
              <div className="flex min-h-0 w-full flex-1 items-end">
                <div
                  className="wrapped-grow w-full rounded-t-xl"
                  style={{
                    height: `${Math.max(6, bar.height)}%`,
                    background: bar.current ? palette.accent : 'currentColor',
                    opacity: bar.current ? 1 : 0.35,
                    animationDelay: `${300 + index * 400}ms`,
                  }}
                />
              </div>
              <span className="text-lg font-black" style={{ color: bar.current ? accentText(palette) : undefined }}>
                {bar.year}
              </span>
            </div>
          ))}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
