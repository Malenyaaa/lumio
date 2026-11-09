import { useId } from 'react'
import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import type { Look } from '../deck'
import { Body, contrast, Headline, In, useFormats, useSubject, type Palette, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { peak: 'Monat mit den meisten Streams:', minutes: (value: string) => `${value} Minuten` },
  en: { peak: 'Month with the most streams:', minutes: (value: string) => `${value} minutes` },
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

/**
 * The chart's colors from the year's look, so it belongs with the rest of that Wrapped: its colors that stand out
 * from this slide, darkest in the middle to lightest at the edge (as Spotify's violet-to-yellow flame). The ring
 * takes the lightest that the dark month names read on.
 */
function chartColors(look: Look, palette: Palette) {
  const all = [...new Set(look.palettes.flatMap((entry) => [entry.accent, ...(entry.background.match(/#[0-9a-f]{6}/gi) ?? [])]))]
  const standing = all.filter((color) => contrast(color, palette.background) >= 1.5)
  const byLight = (standing.length >= 3 ? standing : all).sort((a, b) => contrast(a, '#000000') - contrast(b, '#000000'))
  const spread = [0, 1 / 3, 2 / 3, 1].map((share) => byLight[Math.round(share * (byLight.length - 1))]!)
  const ring = [...all].reverse().find((color) => contrast(color, INK) >= 4.5) ?? '#ffffff'
  return { stops: spread, ring }
}

/** The lines and month names. */
const INK = '#1a1033'

/** Months clockwise from the top (January at about one o'clock), as on Spotify's dial. */
const angleOf = (month: number) => ((month + 0.5) / 12) * Math.PI * 2 - Math.PI / 2

/**
 * A place of a ranking (an artist, song or album) inside a ring of months; around it a flaming shape reaching out in
 * each month as far as it was heard then: a round chart (2023). A pointer marks the month with the most streams.
 */
export default {
  id: 'spotlight-dial',
  topic: 'spotlight',
  series: ['artists', 'songs', 'albums'],
  Component: ({ data, look, palette, spot }) => {
    const t = useMessages(messages)
    const { month, shortMonth, number } = useFormats()
    const gradient = useId()
    const top = useSubject(data, spot, 480)
    const photo = top.image
    // Data from before the months were sent: an even ring.
    const perMonth = top.peakMonth === null ? Array<number>(12).fill(1) : top.months
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
    const colors = chartColors(look, palette)
    const peak = angleOf(top.peakMonth ?? 0)
    // On the tip of the busiest month (it reaches out the furthest).
    const pointer = RING + 14 + REACH
    return (
      <Body className="items-center justify-center gap-4 text-center">
        <In>
          <p className="text-2xl font-black">{top.rank + 1}.</p>
          <Headline look={look} className="line-clamp-2 text-4xl break-words">
            {top.name}
          </Headline>
          {top.by && <p className="mt-1 truncate text-lg font-bold">{top.by}</p>}
        </In>
        <div className="relative w-full max-w-[22rem]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id={gradient} cx="50%" cy="50%" r="50%">
                {colors.stops.map((color, index) => (
                  <stop key={index} offset={`${55 + index * 15}%`} stopColor={color} />
                ))}
              </radialGradient>
            </defs>
            {/* The chart: growing out of the ring. */}
            <g className="wrapped-spring animate-in zoom-in-50 fade-in-0 duration-1000 fill-mode-both [animation-delay:300ms]" style={{ transformOrigin: 'center' }}>
              <path d={smoothLoop(points)} fill={`url(#${gradient})`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            </g>
            <circle cx={CENTER} cy={CENTER} r={RING} fill={colors.ring} stroke={INK} strokeWidth="3" />
            <circle cx={CENTER} cy={CENTER} r={RING - 22} fill="none" stroke={INK} strokeWidth="2" />
            {Array.from({ length: 12 }, (_, index) => {
              const edge = ((index + 1) / 12) * Math.PI * 2 - Math.PI / 2
              const middle = angleOf(index)
              const label = RING - 11
              return (
                <g key={index}>
                  <line x1={CENTER + Math.cos(edge) * (RING - 22)} y1={CENTER + Math.sin(edge) * (RING - 22)} x2={CENTER + Math.cos(edge) * RING} y2={CENTER + Math.sin(edge) * RING} stroke={INK} strokeWidth="2" />
                  <text
                    x={CENTER + Math.cos(middle) * label}
                    y={CENTER + Math.sin(middle) * label}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fontWeight="800"
                    fill={INK}
                    transform={`rotate(${(middle * 180) / Math.PI + 90} ${CENTER + Math.cos(middle) * label} ${CENTER + Math.sin(middle) * label})`}
                  >
                    {shortMonth.format(new Date(Date.UTC(data.year, index, 1))).replace('.', '').toUpperCase()}
                  </text>
                </g>
              )
            })}
            {/* The pointer at the busiest month. */}
            {top.peakMonth !== null && <g className="animate-in zoom-in-0 fill-mode-both [animation-delay:1300ms]" style={{ transformOrigin: `${CENTER + Math.cos(peak) * pointer}px ${CENTER + Math.sin(peak) * pointer}px` }}>
              <circle cx={CENTER + Math.cos(peak) * pointer} cy={CENTER + Math.sin(peak) * pointer} r="15" fill="#fff" stroke="#111" strokeWidth="4" />
              <circle cx={CENTER + Math.cos(peak) * pointer} cy={CENTER + Math.sin(peak) * pointer} r="7" fill="#111" />
            </g>}
          </svg>
          <div className={`absolute top-1/2 left-1/2 aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black/20 shadow-lg ${top.person ? '' : 'rounded-sm'}`}>
            {photo && <FadeImage src={photo} alt="" className="size-full object-cover" />}
          </div>
        </div>
        <In delay={1100}>
          {top.peakMonth !== null ? (
            <>
              <p className="text-lg font-semibold">{t.peak}</p>
              <p className="text-3xl font-black">{month.format(new Date(Date.UTC(data.year, top.peakMonth, 1)))}</p>
            </>
          ) : (
            <p className="text-3xl font-black">{t.minutes(number.format(top.minutes))}</p>
          )}
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
