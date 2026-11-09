import { defineMessages, useMessages } from '@/lib/i18n'
import type { Wrapped } from '../wrapped-data'
import { accentText, Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Musik ist bei dir kein Hobby. Sie ist Alltag.',
    days: (active: string, all: string) => `an ${active} von ${all} Tagen`,
    silent: (count: number) => (count === 0 ? 'Kein einziger stiller Tag.' : count === 1 ? 'Nur ein einziger Tag blieb still.' : `Nur ${count} Tage blieben still.`),
  },
  en: {
    lead: 'Music isn’t a hobby for you. It’s everyday life.',
    days: (active: string, all: string) => `on ${active} of ${all} days`,
    silent: (count: number) => (count === 0 ? 'Not a single silent day.' : count === 1 ? 'Just one day stayed silent.' : `Just ${count} days stayed silent.`),
  },
})

/**
 * The days the year had so far: all of them for a year that is over, up to the last day with music for the running
 * one (it can't have had music on days still to come). Never under 85 % of the year, so a year that went quiet early
 * isn't taken for one with music every day; a whole year without the days from the server.
 */
function span(data: Wrapped) {
  const days = data.daily.length
  if (!days) return 365
  let last = data.daily.length - 1
  while (last >= 0 && !(data.daily[last]! > 0)) last--
  return Math.min(days, Math.max(last + 1, Math.round(days * 0.85)))
}

/**
 * Music (almost) every day of the year: a contribution calendar filling in square by square, the few silent days
 * left as hollow outlines, "on 351 of 365 days" below.
 */
export default {
  id: 'special-every-day',
  topic: 'special',
  after: 'streak',
  // Nine days in ten with music.
  special: (data) => {
    const days = span(data)
    const share = Math.min(data.activeDays, days) / days
    return share >= 0.9 ? Math.max(1, Math.min(1.12, share / 0.9)) : 0
  },
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const days = span(data)
    const active = Math.min(data.activeDays, days)
    // Without the days from the server (an older one): the active days first.
    const daily = Array.from({ length: days }, (_, index) => (data.daily.length ? (data.daily[index] ?? 0) : index < active ? 1 : 0))
    // Weeks as columns (Monday on top), as a contribution calendar.
    const offset = (new Date(Date.UTC(data.year, 0, 1)).getUTCDay() + 6) % 7
    const accent = accentText(palette)
    return (
      <Body className="justify-center gap-6">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <div className="grid grid-flow-col grid-rows-7 gap-[2px]" aria-hidden>
          {Array.from({ length: offset }, (_, index) => (
            <span key={`pad${index}`} />
          ))}
          {daily.map((minutes, index) => (
            <span
              key={index}
              className="aspect-square animate-in zoom-in-0 rounded-[2px] fill-mode-both"
              style={{
                ...(minutes > 0 ? { background: palette.accent } : { boxShadow: 'inset 0 0 0 1px currentColor', opacity: 0.8 }),
                animationDelay: `${200 + index * 4}ms`,
                animationDuration: '300ms',
              }}
            />
          ))}
        </div>
        <In delay={200 + days * 4}>
          <Headline look={look} className="text-[clamp(2.2rem,11vw,3.2rem)]">
            <span style={{ color: accent }}>{t.days(number.format(active), number.format(days))}</span>
          </Headline>
          <p className="mt-3 text-lg font-semibold">{t.silent(days - active)}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
