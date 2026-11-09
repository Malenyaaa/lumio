import { defineMessages, useMessages } from '@/lib/i18n'
import type { Wrapped } from '../wrapped-data'
import { accentText, Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    weekendLead: 'Wenn die Woche vorbei ist, geht’s los.',
    weekendTitle: 'Wochenend-Hörer*in',
    weekdaysLead: 'Montag bis Freitag, volle Lautstärke.',
    weekdaysTitle: 'Dein Soundtrack für die Werktage',
    ratio: (ratio: string, weekend: boolean) => `${weekend ? 'Samstags und sonntags' : 'Unter der Woche'} hörst du ${ratio}-mal so viel wie ${weekend ? 'unter der Woche' : 'am Wochenende'}.`,
    only: (weekend: boolean) => (weekend ? 'Unter der Woche: Funkstille.' : 'Am Wochenende: Funkstille.'),
  },
  en: {
    weekendLead: 'When the week is done, it starts.',
    weekendTitle: 'Weekend listener',
    weekdaysLead: 'Monday to Friday, full volume.',
    weekdaysTitle: 'Your soundtrack for the working week',
    ratio: (ratio: string, weekend: boolean) => `${weekend ? 'On Saturdays and Sundays' : 'During the week'} you listen ${ratio} times as much as ${weekend ? 'during the week' : 'at the weekend'}.`,
    only: (weekend: boolean) => (weekend ? 'During the week: radio silence.' : 'At the weekend: radio silence.'),
  },
})

/** Saturday and Sunday (the weekdays are Monday first). */
const WEEKEND = [5, 6]

/** The weekend's and the working days' minutes per day; how many times one is the other (Infinity: only one has music). */
function rhythm(data: Wrapped) {
  const days = data.weekdays.length === 7 ? data.weekdays : Array<number>(7).fill(0)
  const weekend = (days[5]! + days[6]!) / 2
  const weekdays = days.slice(0, 5).reduce((sum, minutes) => sum + minutes, 0) / 5
  const strong = Math.max(weekend, weekdays)
  const weak = Math.min(weekend, weekdays)
  return { weekend: weekend >= weekdays, ratio: strong <= 0 ? 0 : weak > 0 ? strong / weak : Infinity, total: days.reduce((sum, minutes) => sum + minutes, 0) }
}

/**
 * A week with a clear favourite part: the weekend or the working days. Seven columns for the days, the strong ones in
 * the accent and rising high, the ratio of the two below.
 */
export default {
  id: 'special-weekly-rhythm',
  topic: 'special',
  after: 'clock',
  // One part of the week with 1.6 times the music per day of the other (and five hours at least, for a pattern).
  special: (data) => {
    const { ratio, total } = rhythm(data)
    if (total < 300) return 0
    const strength = ratio / 1.6
    return strength >= 1 ? Math.min(3, strength) : 0
  },
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { locale } = useFormats()
    const { weekend, ratio } = rhythm(data)
    const mood = weekend ? { lead: t.weekendLead, title: t.weekendTitle } : { lead: t.weekdaysLead, title: t.weekdaysTitle }
    const max = Math.max(1, ...data.weekdays)
    // A Monday (1 January 2024) and the six days after it, for the days' short names.
    const name = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    const accent = accentText(palette)
    return (
      <Body className="justify-center gap-6">
        <In>
          <p className="text-2xl font-bold">{mood.lead}</p>
        </In>
        <In delay={200}>
          <Headline look={look} className="text-[clamp(2.2rem,11vw,3rem)] break-words">
            <span style={{ color: accent }}>{mood.title}</span>
          </Headline>
        </In>
        <div aria-hidden className="grid grid-cols-7 items-end gap-2">
          {Array.from({ length: 7 }, (_, day) => {
            const minutes = data.weekdays[day] ?? 0
            const strong = WEEKEND.includes(day) === weekend
            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div className="flex h-40 w-full items-end">
                  <div
                    className="wrapped-grow w-full rounded-t-lg"
                    style={{ height: `${Math.max(4, (minutes / max) * 100)}%`, background: strong ? palette.accent : 'currentColor', opacity: strong ? 1 : 0.3, animationDelay: `${600 + day * 90}ms` }}
                  />
                </div>
                <span className="text-xs font-bold uppercase" style={strong ? { color: accent } : { opacity: 0.7 }}>
                  {name.format(Date.UTC(2024, 0, 1 + day)).replace('.', '').slice(0, 2)}
                </span>
              </div>
            )
          })}
        </div>
        <In delay={1400}>
          <p className="text-xl font-bold">{Number.isFinite(ratio) ? t.ratio(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(ratio), weekend) : t.only(weekend)}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
