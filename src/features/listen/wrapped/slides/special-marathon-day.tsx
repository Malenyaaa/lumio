import { defineMessages, useMessages } from '@/lib/i18n'
import '../specials-a.css'
import { accentText, Body, dateOf, Headline, In, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'
import type { Wrapped } from '../wrapped-data'

const messages = defineMessages({
  de: {
    lead: 'Und dann war da dieser eine Tag',
    hours: 'Stunden Musik an einem einzigen Tag.',
    times: (times: number) => `${times}-mal so viel wie an einem üblichen Tag. Alles okay?`,
  },
  en: {
    lead: 'And then there was that one day',
    hours: 'hours of music in a single day.',
    times: (times: number) => `${times} times as much as a usual day. You okay?`,
  },
})

/** The biggest day against an ordinary one (the year's minutes over its days with music). */
function spike(data: Wrapped) {
  if (!data.topDay || data.activeDays <= 0 || data.minutes <= 0) return 0
  return data.topDay.minutes / (data.minutes / data.activeDays)
}

/**
 * One marathon day: its date big, the day's 24 hours as a clock filling up with the music, and the year's days as a
 * strip with that day's spike marked. For a day of six hours or more, four times an ordinary one.
 */
export default {
  id: 'special-marathon-day',
  topic: 'special',
  special: (data) => ((data.topDay?.minutes ?? 0) >= 360 && spike(data) >= 4 ? Math.min(3, spike(data) / 4) : 0),
  after: 'minutes',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { day, weekday } = useFormats()
    const top = data.topDay!
    const date = dateOf(top.date)
    const hours = useCountUp(Math.round(top.minutes / 60), active, 1400, 700)
    const filled = Math.min(100, (top.minutes / 1440) * 100)
    const index = Math.round((date.getTime() - Date.UTC(data.year, 0, 1)) / 86_400_000)
    const max = Math.max(1, ...data.daily)
    const marked = index >= 0 && index < data.daily.length
    return (
      <Body className="justify-center gap-5">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <In delay={200} from="left">
          <p className="text-lg font-bold opacity-80">{weekday.format(date)}</p>
          <Headline look={look} className="text-[clamp(2.2rem,11vw,3rem)] break-words">
            <span style={{ color: accentText(palette) }}>{day.format(date)}</span>
          </Headline>
        </In>
        <div className="flex items-center gap-4">
          <In delay={400} from="zoom" className="relative size-28 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="18" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={palette.accent}
                strokeWidth="18"
                pathLength="100"
                className="wrapped-sa-arc"
                style={{ strokeDasharray: `${filled} 100`, animationDelay: '700ms' }}
              />
              {Array.from({ length: 24 }, (_, hour) => (
                <line key={hour} x1="81" y1="50" x2="99" y2="50" transform={`rotate(${hour * 15} 50 50)`} stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.6" />
              ))}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-3xl font-black tabular-nums">
              {hours}
              <span className="text-sm font-bold opacity-70">/24</span>
            </span>
          </In>
          <In delay={800} className="min-w-0 flex-1">
            <p className="text-xl leading-tight font-black">
              {hours} {t.hours}
            </p>
            <p className="mt-2 text-sm font-semibold">{t.times(Math.round(spike(data)))}</p>
          </In>
        </div>
        {data.daily.length > 0 && (
          <In delay={1100} className="relative mt-4">
            {marked && (
              <span className="wrapped-sa-bob absolute -top-5 -translate-x-1/2 text-sm leading-none" style={{ left: `${((index + 0.5) / data.daily.length) * 100}%`, color: accentText(palette) }} aria-hidden>
                ▼
              </span>
            )}
            <svg viewBox={`0 0 ${data.daily.length} 100`} preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
              {data.daily.map((minutes, at) =>
                minutes > 0 ? (
                  <rect key={at} x={at === index ? at - 1 : at} y={100 - Math.max(2, (minutes / max) * 100)} width={at === index ? 3 : 0.8} height={Math.max(2, (minutes / max) * 100)} fill={at === index ? palette.accent : 'currentColor'} opacity={at === index ? 1 : 0.4} />
                ) : null,
              )}
            </svg>
          </In>
        )}
      </Body>
    )
  },
} satisfies WrappedSlide
