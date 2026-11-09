import '../specials-b.css'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { Wrapped } from '../wrapped-data'
import { accentText, Body, Headline, In, useCountUp, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    title: 'Früh\u00adauf\u00adsteher*in',
    share: 'deiner Musik lief zwischen 5 und 9 Uhr morgens. Der Kaffee hatte nie eine Chance gegen dich.',
    favourite: (hour: number) => `Deine Lieblingsstunde: ${hour} Uhr`,
  },
  en: {
    title: 'Early bird',
    share: 'of your music played between 5 and 9 in the morning. Your coffee never stood a chance.',
    favourite: (hour: number) => `Your favourite hour: ${hour} a.m.`,
  },
})

/** The morning hours (5 to 9). */
const MORNING = [5, 6, 7, 8]

/** The share of the minutes played in the morning hours (0 without any). */
function morningShare(data: Wrapped) {
  const total = data.hours.reduce((sum, minutes) => sum + minutes, 0)
  return total > 0 ? MORNING.reduce((sum, hour) => sum + (data.hours[hour] ?? 0), 0) / total : 0
}

/**
 * Someone whose music starts with the day: a sun coming up over the horizon, the day's 24 hours as a strip with the
 * early ones lit, the morning's share and its favourite hour.
 */
export default {
  id: 'special-early-bird',
  topic: 'special',
  after: 'clock',
  // Over a sixth of the minutes between 5 and 9 (a usual year has about a tenth there).
  special: (data) => {
    const strength = morningShare(data) / 0.18
    return strength >= 1 ? Math.min(3, strength) : 0
  },
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const percent = useCountUp(Math.round(morningShare(data) * 100), active, 1400, 900)
    const max = Math.max(1, ...data.hours)
    const favourite = MORNING.reduce((best, hour) => ((data.hours[hour] ?? 0) > (data.hours[best] ?? 0) ? hour : best), MORNING[0]!)
    const accent = accentText(palette)
    return (
      <Body className="justify-center gap-4">
        <div aria-hidden className="relative h-24 overflow-hidden">
          <div className="wrapped-sb-sunrise absolute inset-x-0 bottom-0 flex justify-center">
            <svg viewBox="0 0 200 100" className="h-24 overflow-visible">
              {Array.from({ length: 9 }, (_, index) => {
                const angle = Math.PI + (index / 8) * Math.PI
                return <line key={index} x1={100 + Math.cos(angle) * 54} y1={100 + Math.sin(angle) * 54} x2={100 + Math.cos(angle) * 74} y2={100 + Math.sin(angle) * 74} stroke={palette.accent} strokeWidth="6" strokeLinecap="round" />
              })}
              <circle cx="100" cy="100" r="44" fill={palette.accent} />
            </svg>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-current" />
        </div>
        <In delay={500}>
          <Headline look={look} className="text-5xl break-words">
            {t.title}
          </Headline>
        </In>
        <In delay={800}>
          <p className="text-6xl font-black tabular-nums" style={{ color: accent }}>
            {percent} %
          </p>
          <p className="mt-2 text-lg font-semibold">{t.share}</p>
        </In>
        <In delay={1200}>
          <div aria-hidden className="flex h-16 items-end gap-[3px]">
            {data.hours.map((minutes, hour) => {
              const morning = MORNING.includes(hour)
              return (
                <div
                  key={hour}
                  className="wrapped-grow flex-1 rounded-t-sm"
                  style={{ height: `${Math.max(6, (minutes / max) * 100)}%`, background: morning ? palette.accent : 'currentColor', opacity: morning ? 1 : 0.25, animationDelay: `${1300 + hour * 30}ms` }}
                />
              )
            })}
          </div>
          <div aria-hidden className="mt-1 flex justify-between text-xs font-semibold">
            {[0, 6, 12, 18, 24].map((hour) => (
              <span key={hour}>{hour}</span>
            ))}
          </div>
        </In>
        <In delay={1900}>
          <p className="text-xl font-bold">{t.favourite(favourite)}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
