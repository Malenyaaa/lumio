import type { CSSProperties } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../spotlights.css'
import { accentText, Body, displayClass, Headline, In, onAccent, useFormats, useSubject, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    artists: 'Deine Top-Künstler*innen', songs: 'Deine Top-Songs', albums: 'Deine Top-Alben',
    place: (rank: number, count: number) => `Platz ${rank} von ${count}`,
    top: 'Deine Nummer 1',
    stats: (minutes: string, plays: string) => `${minutes} Minuten · ${plays} Streams`,
  },
  en: {
    artists: 'Your top artists', songs: 'Your top songs', albums: 'Your top albums',
    place: (rank: number, count: number) => `Number ${rank} of ${count}`,
    top: 'Your number 1',
    stats: (minutes: string, plays: string) => `${minutes} minutes · ${plays} streams`,
  },
})

/** Half the gap between two bars, in percent of the chart's width. */
const GAP = 0.9
/** The tallest bar's share of the chart's height (the peak's label goes above it). */
const TALLEST = 82

/**
 * The twelve months as a skyline of tall bars, the picture showing through them as through windows, rising one
 * after another; the place as a giant numeral above, the busiest month named on its roof.
 */
export default {
  id: 'spotlight-skyline',
  topic: 'spotlight',
  series: ['artists', 'songs', 'albums'],
  Component: ({ data, look, palette, spot }) => {
    const t = useMessages(messages)
    const { number, month, shortMonth } = useFormats()
    const subject = useSubject(data, spot, 720)
    const first = subject.rank === 0
    const peak = subject.peakMonth
    // Without months an even row: still the picture in bars, only nothing to point at.
    const max = Math.max(1, ...subject.months)
    const height = (index: number) => (peak === null ? 46 : Math.max(5, ((subject.months[index] ?? 0) / max) * TALLEST))
    const picture: CSSProperties = subject.image ? { backgroundImage: `url("${subject.image}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: palette.accent }
    return (
      <Body className="gap-4">
        <In>
          {first ? (
            <p className="inline-block rounded-full px-3 py-1 text-sm font-black tracking-wide uppercase" style={{ background: palette.accent, color: onAccent(palette) }}>
              {t.top}
            </p>
          ) : (
            <p className="text-sm font-bold tracking-wide uppercase">{t.place(subject.rank + 1, spot?.count ?? subject.rank + 1)}</p>
          )}
          <p className="mt-2 text-xs font-bold tracking-wide uppercase opacity-80">{t[subject.series]}</p>
        </In>
        <div className="flex min-w-0 items-end gap-3">
          <In from={first ? 'zoom' : 'left'} delay={150} className="shrink-0">
            <p className={`leading-[0.8] ${displayClass(look)} ${first ? 'text-[10rem]' : 'text-[8rem]'}`} style={{ color: accentText(palette) }}>
              {subject.rank + 1}
            </p>
          </In>
          <In delay={350} className="min-w-0 pb-1">
            <Headline look={look} className="line-clamp-3 text-[clamp(1.6rem,7.5vw,2.4rem)] break-words">
              {subject.name}
            </Headline>
            {subject.by && <p className="mt-1 truncate text-base font-bold">{subject.by}</p>}
          </In>
        </div>
        <In delay={500}>
          <p className={peak === null ? 'text-2xl font-black' : 'text-base font-semibold'}>{t.stats(number.format(subject.minutes), number.format(subject.plays))}</p>
        </In>
        <div className="relative mt-auto min-h-44 flex-1" aria-hidden>
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="wrapped-spot-rise absolute inset-0"
              style={
                {
                  ...picture,
                  '--left': `${(index * 100) / 12 + GAP}%`,
                  '--right': `${100 - ((index + 1) * 100) / 12 + GAP}%`,
                  '--top': `${100 - height(index)}%`,
                  animationDelay: `${700 + index * 90}ms`,
                } as CSSProperties
              }
            />
          ))}
          {peak !== null && (
            <div
              className="absolute"
              style={{
                bottom: `calc(${height(peak)}% + 0.5rem)`,
                // The first and last months' labels lean inwards, so they stay on the slide.
                ...(peak < 2 ? { left: `${(peak * 100) / 12 + GAP}%` } : peak > 9 ? { right: `${100 - ((peak + 1) * 100) / 12 + GAP}%` } : { left: `${((peak + 0.5) * 100) / 12}%`, translate: '-50% 0' }),
              }}
            >
              <In delay={700 + 12 * 90 + 200} from="zoom">
                <span className="block rounded-full px-2.5 py-0.5 text-sm font-black whitespace-nowrap shadow-lg" style={{ background: palette.accent, color: onAccent(palette) }}>
                  {month.format(new Date(Date.UTC(data.year, peak, 1)))}
                </span>
              </In>
            </div>
          )}
        </div>
        <div className="-mt-2 grid grid-cols-12 border-t-2 pt-1 text-center" style={{ borderColor: accentText(palette) }} aria-hidden>
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} className={`text-[10px] font-bold uppercase ${index === peak ? '' : 'opacity-60'}`}>
              {shortMonth.format(new Date(Date.UTC(data.year, index, 1))).slice(0, 1)}
            </span>
          ))}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
