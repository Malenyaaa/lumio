import '../specials-b.css'
import { defineMessages, useMessages } from '@/lib/i18n'
import { accentText, Body, Headline, In, Picture, useCountUp, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Du hast',
    times: (count: string) => `${count}-mal gehört.`,
    hours: (value: string) => `Das sind ${value} Stunden in Dauerschleife.`,
    minutes: (value: string) => `Das sind ${value} Minuten in Dauerschleife.`,
  },
  en: {
    lead: 'You played',
    times: (count: string) => `${count} times.`,
    hours: (value: string) => `That’s ${value} hours on loop.`,
    minutes: (value: string) => `That’s ${value} minutes on loop.`,
  },
})

/** The ticks around the cover, and how long one round of the light along them takes. */
const TICKS = 60
const LOOP = 3

/**
 * The song played most, often enough to stand out on its own: its cover inside a ring of tick marks with a light
 * running round and round them, the plays counting up below.
 */
export default {
  id: 'special-song-loop',
  topic: 'special',
  after: 'top-songs',
  // 100 plays, or a twenty-fifth of all streams (from 40 plays on).
  special: (data) => {
    const plays = data.topTracks[0]?.plays ?? 0
    const share = data.plays > 0 ? plays / data.plays : 0
    const strength = Math.max(plays / 100, plays >= 40 ? share / 0.04 : 0)
    return strength >= 1 ? Math.min(3, strength) : 0
  },
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number, locale } = useFormats()
    const track = data.topTracks[0]
    const cover = useTrackCover(track)
    const plays = useCountUp(track?.plays ?? 0, active, 1800, 900)
    const minutes = track?.minutes ?? 0
    const hours = minutes / 60
    const accent = accentText(palette)
    return (
      <Body className="items-center justify-center gap-4 text-center">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
          <Headline look={look} className="mt-1 line-clamp-2 text-3xl break-words">
            {`„${track?.title ?? ''}“`}
          </Headline>
          {track?.artist && <p className="mt-1 truncate text-lg font-semibold opacity-80">{track.artist}</p>}
        </In>
        <In delay={300} from="zoom" className="relative aspect-square w-full max-w-[13.5rem]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden>
            {Array.from({ length: TICKS }, (_, index) => {
              const angle = (index / TICKS) * Math.PI * 2 - Math.PI / 2
              const long = index % 5 === 0
              return (
                <line
                  key={index}
                  x1={100 + Math.cos(angle) * (long ? 84 : 88)}
                  y1={100 + Math.sin(angle) * (long ? 84 : 88)}
                  x2={100 + Math.cos(angle) * 97}
                  y2={100 + Math.sin(angle) * 97}
                  stroke={accent}
                  strokeWidth={long ? 4 : 2.5}
                  strokeLinecap="round"
                  className="wrapped-sb-tick"
                  // Each a little later than the one before: a light chasing round the ring.
                  style={{ animationDelay: `${(index / TICKS - 1) * LOOP}s`, animationDuration: `${LOOP}s` }}
                />
              )
            })}
          </svg>
          <Picture src={cover} round className="absolute inset-[16%]" />
        </In>
        <In delay={800}>
          <Headline look={look} className="text-5xl tabular-nums">
            <span style={{ color: accent }}>{t.times(number.format(plays))}</span>
          </Headline>
        </In>
        <In delay={1500}>
          <p className="text-lg font-semibold">
            {hours >= 1 ? t.hours(new Intl.NumberFormat(locale, { maximumFractionDigits: hours < 10 ? 1 : 0 }).format(hours)) : t.minutes(number.format(Math.round(minutes)))}
          </p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
