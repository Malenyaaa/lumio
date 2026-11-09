import { useId } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../spotlights.css'
import { accentText, Body, displayClass, Headline, In, Picture, useCountUp, useFormats, useSubject, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    artists: 'Deine Top-Künstler*innen', songs: 'Deine Top-Songs', albums: 'Deine Top-Alben',
    place: (rank: number) => `Platz ${rank}`,
    top: 'Deine Nummer 1',
    minutes: 'Minuten',
    plays: (plays: string) => `${plays} Streams`,
  },
  en: {
    artists: 'Your top artists', songs: 'Your top songs', albums: 'Your top albums',
    place: (rank: number) => `Number ${rank}`,
    top: 'Your number 1',
    minutes: 'minutes',
    plays: (plays: string) => `${plays} streams`,
  },
})

/** The chart's drawing: its width and height, where the months' line rests and how far it climbs at most. */
const WIDTH = 360
const HEIGHT = 130
const GROUND = 104
const CLIMB = 76

/** An open, smooth line through the points (Catmull-Rom as Bézier curves). */
function smoothLine(points: Array<[number, number]>) {
  const at = (index: number) => points[Math.max(0, Math.min(points.length - 1, index))]!
  let path = `M ${at(0)[0]} ${at(0)[1]}`
  for (let index = 0; index < points.length - 1; index++) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)]
    path += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`
  }
  return path
}

/**
 * The place as a huge outlined numeral behind the picture, the minutes counting up, and across the foot of the slide
 * the year as a wave: a soft area chart of the months drawing itself, a dot on its crest.
 */
export default {
  id: 'spotlight-wave',
  topic: 'spotlight',
  series: ['artists', 'songs', 'albums'],
  Component: ({ data, look, palette, active, spot }) => {
    const t = useMessages(messages)
    const { number, month, shortMonth } = useFormats()
    const fill = useId()
    const subject = useSubject(data, spot, 480)
    const first = subject.rank === 0
    const minutes = useCountUp(subject.minutes, active, 1600, 500)
    const peak = subject.peakMonth
    const ink = accentText(palette)
    // Without months the sea lies still: a level line.
    const max = Math.max(1, ...subject.months)
    const points = subject.months.map((value, index): [number, number] => [14 + (index * (WIDTH - 28)) / 11, peak === null ? GROUND - CLIMB / 2 : GROUND - (value / max) * CLIMB])
    const line = smoothLine(points)
    const crest = peak === null ? null : points[peak]!
    return (
      <>
        <div aria-hidden className="absolute -right-6 top-[calc(max(0.75rem,var(--safe-top))+3rem)]">
          <In from="fade" delay={100}>
            <p className={`wrapped-outline leading-[0.8] ${displayClass(look)} ${first ? 'text-[20rem]' : 'text-[17rem]'}`} style={{ WebkitTextStrokeColor: ink, WebkitTextStrokeWidth: 3 }}>
              {subject.rank + 1}
            </p>
          </In>
        </div>
        <Body className="gap-4">
          <In>
            <p className="text-xs font-bold tracking-wide uppercase opacity-80">{t[subject.series]}</p>
            <p className={`mt-1 ${first ? 'text-3xl' : 'text-2xl'} ${displayClass(look)}`} style={first ? { color: ink } : undefined}>
              {first ? t.top : t.place(subject.rank + 1)}
            </p>
          </In>
          <In from="zoom" delay={250} className="relative self-start">
            {first && <div aria-hidden className="wrapped-ring absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 6px ${palette.accent}` }} />}
            <Picture src={subject.image} round={subject.person} className={`size-36 sm:size-44 ${first ? 'wrapped-float' : ''}`} />
          </In>
          <In delay={450} className="min-w-0">
            <Headline look={look} className="line-clamp-2 text-[clamp(1.8rem,8vw,2.6rem)] break-words">
              {subject.name}
            </Headline>
            {subject.by && <p className="mt-1 truncate text-lg font-bold">{subject.by}</p>}
          </In>
          <In delay={600}>
            <p className="flex items-baseline gap-2">
              <span className={`text-5xl tabular-nums ${displayClass(look)}`} style={{ color: ink }}>
                {number.format(minutes)}
              </span>
              <span className="text-lg font-bold">{t.minutes}</span>
            </p>
            <p className="text-base font-semibold">{t.plays(number.format(subject.plays))}</p>
          </In>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="-mx-7 mt-auto w-[calc(100%+3.5rem)] max-w-none shrink-0 overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.accent} stopOpacity="0.6" />
                <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${line} L ${points[11]![0]} ${HEIGHT} L ${points[0]![0]} ${HEIGHT} Z`}
              fill={`url(#${fill})`}
              className="animate-in fade-in-0 duration-1000 fill-mode-both"
              style={{ animationDelay: '1700ms' }}
            />
            <path d={line} pathLength="1" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" className="wrapped-spot-draw" style={{ animationDelay: '700ms' }} />
            {crest && (
              <g className="wrapped-spring animate-in zoom-in-0 fill-mode-both" style={{ animationDelay: '2100ms', transformOrigin: `${crest[0]}px ${crest[1]}px` }}>
                <circle cx={crest[0]} cy={crest[1]} r="9" fill={palette.color} stroke={ink} strokeWidth="4" />
                <text
                  x={crest[0]}
                  y={crest[1] - 18}
                  // The first and last months' names lean inwards, so they stay on the slide.
                  textAnchor={peak! < 2 ? 'start' : peak! > 9 ? 'end' : 'middle'}
                  fontSize="15"
                  fontWeight="900"
                  fill="currentColor"
                >
                  {month.format(new Date(Date.UTC(data.year, peak!, 1)))}
                </text>
              </g>
            )}
            {peak !== null &&
              points.map(([x], index) => (
                <text key={index} x={x} y={HEIGHT - 6} textAnchor="middle" fontSize="10" fontWeight="800" fill="currentColor" opacity={index === peak ? 1 : 0.6}>
                  {shortMonth.format(new Date(Date.UTC(data.year, index, 1))).slice(0, 1).toUpperCase()}
                </text>
              ))}
          </svg>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
