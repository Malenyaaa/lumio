import { useId } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../spotlights.css'
import { accentText, Body, Headline, In, Picture, smoothLoop, useFormats, useSubject, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    artists: 'Deine Top-Künstler*innen', songs: 'Deine Top-Songs', albums: 'Deine Top-Alben',
    place: (rank: number) => `Platz ${rank}`,
    top: 'Deine Nummer 1',
    peak: (month: string, minutes: string) => `Am meisten im ${month} · ${minutes} Minuten`,
    stats: (minutes: string, plays: string) => `${minutes} Minuten · ${plays} Streams`,
  },
  en: {
    artists: 'Your top artists', songs: 'Your top songs', albums: 'Your top albums',
    place: (rank: number) => `Number ${rank}`,
    top: 'Your number 1',
    peak: (month: string, minutes: string) => `Most in ${month} · ${minutes} minutes`,
    stats: (minutes: string, plays: string) => `${minutes} minutes · ${plays} streams`,
  },
})

const SIZE = 360
const CENTER = SIZE / 2
/** Where the wave starts (just outside the picture), and how far its highest crest reaches beyond that. */
const INNER = 80
const REACH = 72

/** January straight up, then clockwise. */
const angleOf = (month: number) => (month / 12) * Math.PI * 2 - Math.PI / 2

/**
 * The picture as a sun: around it one wave with a crest for each month, as high as the month was, light beams turning
 * slowly behind; the place above, the name below.
 */
export default {
  id: 'spotlight-sunburst',
  topic: 'spotlight',
  series: ['artists', 'songs', 'albums'],
  Component: ({ data, look, palette, spot }) => {
    const t = useMessages(messages)
    const { number, month, shortMonth } = useFormats()
    const subject = useSubject(data, spot, 480)
    const first = subject.rank === 0
    const peak = subject.peakMonth
    const ink = accentText(palette)
    const fill = useId()
    // Without months every crest alike: a plain sun. Rooted, so one big month doesn't leave the rest flat.
    const max = Math.max(1, ...subject.months)
    const length = (index: number) => (peak === null ? REACH * 0.55 : REACH * (0.15 + 0.85 * Math.sqrt((subject.months[index] ?? 0) / max)))
    const at = (angle: number, radius: number): [number, number] => [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius]
    // A crest in each month, a trough between two (lower than the lower of them), so it reads as a wave.
    const points = Array.from({ length: 12 }, (_, index) => [
      at(angleOf(index), INNER + length(index)),
      at(angleOf(index) + Math.PI / 12, INNER + 4 + 0.55 * Math.min(length(index), length((index + 1) % 12))),
    ]).flat()
    const wave = smoothLoop(points)
    const color = first ? palette.accent : 'currentColor'
    const crest = peak === null ? null : at(angleOf(peak), INNER + length(peak))
    return (
      <Body className="items-center justify-center gap-3 text-center">
        <In from={first ? 'zoom' : 'fall'}>
          <p className="text-xs font-bold tracking-wide uppercase opacity-80">{t[subject.series]}</p>
          <Headline look={look} className={`mt-1 ${first ? 'text-5xl' : 'text-4xl'}`}>
            {first ? <span style={{ color: ink }}>{t.top}</span> : t.place(subject.rank + 1)}
          </Headline>
        </In>
        <div className="relative aspect-square w-full max-w-[22rem] shrink-0">
          {/* Beams behind, fading out towards the slide's edges. */}
          <div
            aria-hidden
            className="wrapped-spin absolute top-1/2 left-1/2 size-[190%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: `repeating-conic-gradient(${first ? palette.accent : 'currentColor'} 0 5deg, transparent 5deg 18deg)`,
              opacity: first ? 0.3 : 0.14,
              maskImage: 'radial-gradient(circle, #000 20%, transparent 68%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 68%)',
            }}
          />
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative w-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id={fill} gradientUnits="userSpaceOnUse" cx={CENTER} cy={CENTER} r={INNER + REACH}>
                <stop offset="45%" stopColor={color} stopOpacity={first ? 0.8 : 0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={first ? 0.35 : 0.12} />
              </radialGradient>
            </defs>
            {/* The wave rising out of the picture, then its line drawn round. */}
            <g className="wrapped-spring animate-in zoom-in-50 fade-in-0 duration-1000 fill-mode-both [animation-delay:400ms]" style={{ transformOrigin: 'center' }}>
              <path d={wave} fill={`url(#${fill})`} />
            </g>
            <path d={wave} pathLength="1" fill="none" stroke={first ? ink : 'currentColor'} strokeWidth="4" strokeLinejoin="round" className="wrapped-spot-draw" style={{ animationDelay: '700ms' }} />
            {peak !== null &&
              Array.from({ length: 12 }, (_, index) => {
                const [x, y] = at(angleOf(index), INNER + length(index) + 17)
                return (
                  <text
                    key={index}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={index === peak ? 14 : 11}
                    fontWeight="900"
                    fill={index === peak ? ink : 'currentColor'}
                    className="animate-in fade-in-0 fill-mode-both"
                    style={{ animationDelay: `${1000 + index * 70}ms` }}
                  >
                    {shortMonth.format(new Date(Date.UTC(data.year, index, 1))).slice(0, 1).toUpperCase()}
                  </text>
                )
              })}
            {/* The busiest month's crest. */}
            {crest && (
              <circle
                cx={crest[0]}
                cy={crest[1]}
                r="7"
                fill={ink}
                stroke="currentColor"
                strokeWidth="3"
                className="animate-in zoom-in-0 fill-mode-both"
                style={{ animationDelay: '1500ms', transformOrigin: `${crest[0]}px ${crest[1]}px` }}
              />
            )}
          </svg>
          <div className="absolute top-1/2 left-1/2 w-[38%] -translate-x-1/2 -translate-y-1/2">
            <In from="zoom" delay={150} className="relative">
              {first && <div aria-hidden className="wrapped-ring absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 8px ${palette.accent}` }} />}
              <Picture src={subject.image} round={subject.person} className={`aspect-square w-full ${subject.person ? '' : 'rounded-xl'}`} />
            </In>
          </div>
        </div>
        <In delay={1300} className="w-full min-w-0">
          <Headline look={look} className="line-clamp-2 text-[clamp(1.7rem,7.5vw,2.4rem)] break-words">
            {subject.name}
          </Headline>
          {subject.by && <p className="mt-1 truncate text-lg font-bold">{subject.by}</p>}
          <p className={peak === null ? 'mt-2 text-xl font-black' : 'mt-2 text-base font-semibold'}>
            {peak !== null
              ? t.peak(month.format(new Date(Date.UTC(data.year, peak, 1))), number.format(subject.months[peak] ?? 0))
              : t.stats(number.format(subject.minutes), number.format(subject.plays))}
          </p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
