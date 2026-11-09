import { useId } from 'react'
import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { peak: 'Monat mit den meisten Streams:' },
  en: { peak: 'Month with the most streams:' },
})

const SIZE = 340
const CENTER = SIZE / 2
/** The ring with the months, and how far the shape reaches beyond it at most. */
const RING = 90
const REACH = 50

/** A closed, smooth line through the points (Catmull-Rom as Bézier curves). */
function smoothLoop(points: Array<[number, number]>) {
  const at = (index: number) => points[(index + points.length) % points.length]!
  let path = `M ${at(0)[0]} ${at(0)[1]}`
  for (let index = 0; index < points.length; index++) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    path += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`
  }
  return `${path} Z`
}

/** Months clockwise from the top (January at about one o'clock), as on Spotify's dial. */
const angleOf = (month: number) => ((month + 0.5) / 12) * Math.PI * 2 - Math.PI / 2

/**
 * The year's number-one artist inside a ring of months; around it a flaming shape reaching out in each month as far
 * as they were heard then: a round chart (2023). A pointer marks the month with the most streams.
 */
export default {
  id: 'months-artist-dial',
  topic: 'months',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    const { month, shortMonth } = useFormats()
    const gradient = useId()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 480)
    // Data from before the months were sent: an even ring.
    const perMonth = top.months ?? Array<number>(12).fill(1)
    const max = Math.max(1, ...perMonth)
    // Two points per month (its middle reaching out, its edge closer in), for the soft flame between months.
    const points: Array<[number, number]> = []
    for (let index = 0; index < 12; index++) {
      const share = (perMonth[index] ?? 0) / max
      const middle = angleOf(index)
      const radius = RING + 14 + REACH * Math.sqrt(share)
      points.push([CENTER + Math.cos(middle) * radius, CENTER + Math.sin(middle) * radius])
      const between = middle + Math.PI / 12
      const next = (perMonth[(index + 1) % 12] ?? 0) / max
      const low = RING + 10 + REACH * 0.45 * Math.sqrt(Math.min(share, next))
      points.push([CENTER + Math.cos(between) * low, CENTER + Math.sin(between) * low])
    }
    const peak = angleOf(top.peakMonth)
    // On the tip of the busiest month (it reaches out the furthest).
    const pointer = RING + 14 + REACH
    return (
      <Body className="items-center justify-center gap-4 text-center">
        <In>
          <p className="text-2xl font-black">1.</p>
          <Headline look={look} className="text-4xl">
            {top.name}
          </Headline>
        </In>
        <div className="relative w-full max-w-[22rem]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id={gradient} cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="#8b5cf6" />
                <stop offset="68%" stopColor="#ff4d4d" />
                <stop offset="85%" stopColor="#ff9a1f" />
                <stop offset="100%" stopColor="#ffe14d" />
              </radialGradient>
            </defs>
            {/* The chart: growing out of the ring. */}
            <g className="wrapped-spring animate-in zoom-in-50 fade-in-0 duration-1000 fill-mode-both [animation-delay:300ms]" style={{ transformOrigin: 'center' }}>
              <path d={smoothLoop(points)} fill={`url(#${gradient})`} stroke="#1a1033" strokeWidth="4" strokeLinejoin="round" />
            </g>
            <circle cx={CENTER} cy={CENTER} r={RING} fill="#b3adff" stroke="#1a1033" strokeWidth="3" />
            <circle cx={CENTER} cy={CENTER} r={RING - 22} fill="none" stroke="#1a1033" strokeWidth="2" />
            {Array.from({ length: 12 }, (_, index) => {
              const edge = ((index + 1) / 12) * Math.PI * 2 - Math.PI / 2
              const middle = angleOf(index)
              const label = RING - 11
              return (
                <g key={index}>
                  <line x1={CENTER + Math.cos(edge) * (RING - 22)} y1={CENTER + Math.sin(edge) * (RING - 22)} x2={CENTER + Math.cos(edge) * RING} y2={CENTER + Math.sin(edge) * RING} stroke="#1a1033" strokeWidth="2" />
                  <text
                    x={CENTER + Math.cos(middle) * label}
                    y={CENTER + Math.sin(middle) * label}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fontWeight="800"
                    fill="#1a1033"
                    transform={`rotate(${(middle * 180) / Math.PI + 90} ${CENTER + Math.cos(middle) * label} ${CENTER + Math.sin(middle) * label})`}
                  >
                    {shortMonth.format(new Date(Date.UTC(data.year, index, 1))).replace('.', '').toUpperCase()}
                  </text>
                </g>
              )
            })}
            {/* The pointer at the busiest month. */}
            <g className="animate-in zoom-in-0 fill-mode-both [animation-delay:1300ms]" style={{ transformOrigin: `${CENTER + Math.cos(peak) * pointer}px ${CENTER + Math.sin(peak) * pointer}px` }}>
              <circle cx={CENTER + Math.cos(peak) * pointer} cy={CENTER + Math.sin(peak) * pointer} r="15" fill="#fff" stroke="#111" strokeWidth="4" />
              <circle cx={CENTER + Math.cos(peak) * pointer} cy={CENTER + Math.sin(peak) * pointer} r="7" fill="#111" />
            </g>
          </svg>
          <div className="absolute top-1/2 left-1/2 aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black/20 shadow-lg">
            {photo && <FadeImage src={photo} alt="" className="size-full object-cover" />}
          </div>
        </div>
        <In delay={1100}>
          <p className="text-lg font-semibold">{t.peak}</p>
          <p className="text-3xl font-black">{month.format(new Date(Date.UTC(data.year, top.peakMonth, 1)))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
