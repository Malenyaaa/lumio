import '../specials-b.css'
import { defineMessages, useMessages } from '@/lib/i18n'
import { random } from '../deck'
import type { Wrapped } from '../wrapped-data'
import { accentText, Body, Headline, In, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Du bist auf Entdeckungsreise gegangen.',
    tracks: 'verschiedene Songs. Andere hören dasselbe Album im Kreis, du kartierst ganze Galaxien.',
    artists: (share: number) => `neue Künstler*innen, ${share} % von allen, die du gehört hast. Kein Stern bleibt unentdeckt.`,
    top: (name: string) => `Dein hellster neuer Stern: ${name}`,
  },
  en: {
    lead: 'You went exploring.',
    tracks: 'different songs. Others circle one album; you charted whole galaxies.',
    artists: (share: number) => `new artists, ${share}% of everyone you heard. No star left unfound.`,
    top: (name: string) => `Your brightest new star: ${name}`,
  },
})

/** How far the year went: by its many different songs, and by its share of new artists (from 30 on). */
function reach(data: Wrapped) {
  const tracks = data.tracks / 1500
  const share = data.artists > 0 ? data.newArtists.count / data.artists : 0
  const artists = data.newArtists.count >= 30 ? share / 0.4 : 0
  return { tracks, artists, share }
}

/** The stars of the drawing (in a 300 × 200 field) and how many of them are joined by lines. */
const STARS = 70
const LINKED = 9

/**
 * Someone who heard far more widely than most: a constellation of stars twinkling in one by one, a few of them
 * joined by lines, over a big count of the different songs (or the new artists, whichever stands out more).
 */
export default {
  id: 'special-explorer',
  topic: 'special',
  after: 'discoveries',
  // 1500 different songs, or new artists for two fifths of all (30 at least).
  special: (data) => {
    const { tracks, artists } = reach(data)
    const strength = Math.max(tracks, artists)
    return strength >= 1 ? Math.min(3, strength) : 0
  },
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const { tracks, artists, share } = reach(data)
    const bySongs = tracks >= artists
    const count = useCountUp(bySongs ? data.tracks : data.newArtists.count, active, 1800, 400)
    const next = random(data.year * 4057 + 11)
    const stars = Array.from({ length: STARS }, () => ({ x: 6 + next() * 288, y: 6 + next() * 188, size: 0.8 + next() * 2.2, phase: next() }))
    const accent = accentText(palette)
    const top = data.newArtists.top
    return (
      <Body className="justify-center gap-5">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <svg viewBox="0 0 300 200" className="w-full overflow-visible" aria-hidden>
          <polyline
            points={stars
              .slice(0, LINKED)
              // Left to right: a chain, not a scribble.
              .sort((a, b) => a.x - b.x)
              .map((star) => `${star.x},${star.y}`)
              .join(' ')}
            fill="none"
            stroke={palette.accent}
            strokeOpacity="0.6"
            strokeWidth="1"
            strokeLinejoin="round"
            className="wrapped-draw"
            style={{ animationDelay: '1200ms' }}
          />
          {stars.map((star, index) => (
            <g key={index} className="animate-in zoom-in-0 fade-in-0 fill-mode-both" style={{ animationDelay: `${index * 22}ms`, animationDuration: '500ms', transformOrigin: `${star.x}px ${star.y}px` }}>
              <circle
                cx={star.x}
                cy={star.y}
                r={index < LINKED ? star.size + 1 : star.size}
                fill={index < LINKED ? palette.accent : 'currentColor'}
                className="wrapped-sb-twinkle"
                style={{ animationDelay: `${-star.phase * 2.8}s` }}
              />
            </g>
          ))}
        </svg>
        <In delay={600}>
          <Headline look={look} className="text-7xl tabular-nums">
            <span style={{ color: accent }}>{number.format(count)}</span>
          </Headline>
          <p className="mt-2 text-lg font-semibold">{bySongs ? t.tracks : t.artists(Math.round(share * 100))}</p>
        </In>
        {top && (
          <In delay={1400}>
            <p className="line-clamp-2 text-xl font-bold break-words">{t.top(top.name)}</p>
          </In>
        )}
      </Body>
    )
  },
} satisfies WrappedSlide
