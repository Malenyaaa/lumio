import { useMemo } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../specials-a.css'
import { random } from '../deck'
import { Body, Headline, In, useCountUp, type WrappedSlide } from '../slide-kit'

const MOON = '#fdf3c4'

const messages = defineMessages({
  de: {
    lead: 'Schlaf wird überbewertet.',
    share: 'deiner Musik lief zwischen Mitternacht und vier Uhr früh.',
    peak: (hour: number) => `Deine Geisterstunde: ${hour} Uhr.`,
  },
  en: {
    lead: 'Sleep is overrated.',
    share: 'of your music played between midnight and 4 am.',
    peak: (hour: number) => `Your witching hour: ${hour || 12} am.`,
  },
})

/**
 * A night owl's year: a starry sky with the moon rising, the share of music between midnight and four as a big
 * percentage, the day's 24 hours as a strip with the small hours lit, and the late hour played most. For a year with an
 * eighth of its minutes or more in the small hours.
 */
export default {
  id: 'special-night-owl',
  topic: 'special',
  // A few late songs in a year of barely any music make no night owl.
  special: (data) => (data.minutes >= 600 && data.lateNight >= 0.12 ? Math.min(3, data.lateNight / 0.12) : 0),
  after: 'clock',
  backdrop: false,
  ink: '#ffffff',
  Component: ({ data, look, active }) => {
    const t = useMessages(messages)
    const percent = useCountUp(Math.round(data.lateNight * 100), active, 1600, 600)
    const stars = useMemo(() => {
      const next = random(data.year * 7 + 1)
      return Array.from({ length: 50 }, () => ({ x: next() * 100, y: next() * 70, size: 1 + next() * 2, delay: next() * -3 }))
    }, [data.year])
    const max = Math.max(1, ...data.hours)
    const late = data.hours.slice(0, 4)
    const peak = late.indexOf(Math.max(...late))
    return (
      <>
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #050816 0%, #11123a 60%, #2a1650 100%)' }} />
        {stars.map((star, index) => (
          <span
            key={index}
            aria-hidden
            className="wrapped-sa-twinkle absolute rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, animationDelay: `${star.delay}s` }}
          />
        ))}
        <div aria-hidden className="wrapped-sa-moon absolute top-[12%] right-[10%] size-24">
          <div className="size-full rounded-full" style={{ boxShadow: `inset -22px 10px 0 0 ${MOON}`, filter: `drop-shadow(0 0 18px ${MOON}88)` }} />
        </div>
        <Body className="justify-end gap-4 text-white">
          <In>
            <Headline look={look} className="text-3xl">
              {t.lead}
            </Headline>
          </In>
          <In delay={400}>
            <p className="text-[6.5rem] leading-none font-black tabular-nums" style={{ color: MOON }}>
              {percent} %
            </p>
            <p className="mt-1 text-lg font-bold">{t.share}</p>
          </In>
          <In delay={1000} className="mt-2">
            <div className="relative flex h-20 items-end gap-[3px]" aria-hidden>
              <div className="absolute inset-y-0 left-0 w-[calc((100%+3px)/6-3px)] rounded-md bg-white/10" />
              {data.hours.map((minutes, hour) => (
                <div
                  key={hour}
                  className="wrapped-grow relative flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(4, (minutes / max) * 100)}%`,
                    background: hour < 4 ? MOON : '#ffffff',
                    opacity: hour < 4 ? 1 : 0.3,
                    animationDelay: `${1100 + hour * 35}ms`,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-bold opacity-70" aria-hidden>
              {[0, 6, 12, 18, 24].map((hour) => (
                <span key={hour}>{hour}</span>
              ))}
            </div>
          </In>
          {(late[peak] ?? 0) > 0 && (
            <In delay={1600}>
              <p className="text-lg font-semibold">{t.peak(peak)}</p>
            </In>
          )}
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
