import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Rund um die Uhr', peak: (hour: number) => `Am liebsten hörst du um ${hour} Uhr.`, night: (percent: number) => `${percent} % deiner Musik lief zwischen Mitternacht und vier Uhr früh.` },
  en: { lead: 'Around the clock', peak: (hour: number) => `You like listening most at ${hour}:00.`, night: (percent: number) => `${percent}% of your music played between midnight and 4 am.` },
})

/** A 24-hour dial: a petal per hour, longer the more was played, the busiest one lit. */
export default {
  id: 'clock-dial',
  topic: 'clock',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const max = Math.max(1, ...data.hours)
    const peak = data.hours.indexOf(max)
    const night = Math.round(data.lateNight * 100)
    return (
      <Body className="items-center justify-center gap-6 text-center">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <svg viewBox="-110 -110 220 220" className="size-72" aria-hidden>
          <circle r="22" fill={palette.accent} />
          {data.hours.map((minutes, hour) => {
            const length = 28 + (minutes / max) * 70
            return (
              <g key={hour} transform={`rotate(${hour * 15 - 180})`}>
                <rect
                  x="-4"
                  y={26}
                  width="8"
                  height={length - 26}
                  rx="4"
                  fill={hour === peak ? palette.accent : 'currentColor'}
                  opacity={hour === peak ? 1 : 0.3 + 0.6 * (minutes / max)}
                  className="wrapped-grow"
                  style={{ transformOrigin: 'center top', transformBox: 'fill-box', animationDelay: `${200 + hour * 40}ms` }}
                />
              </g>
            )
          })}
          {[0, 6, 12, 18].map((hour) => (
            <text key={hour} x={Math.sin((hour * 15 * Math.PI) / 180) * 104} y={-Math.cos((hour * 15 * Math.PI) / 180) * 104 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">
              {hour}
            </text>
          ))}
        </svg>
        <In delay={1300}>
          <Headline look={look} className="text-3xl">
            {t.peak(peak)}
          </Headline>
          {night >= 10 && <p className="mt-3 text-lg font-semibold">{t.night(night)}</p>}
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
