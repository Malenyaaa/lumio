import type { CSSProperties } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../spotlights.css'
import { Body, displayClass, Headline, In, onAccent, Picture, useFormats, useSubject, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    artists: 'Top-Künstler*innen', songs: 'Top-Songs', albums: 'Top-Alben',
    place: (rank: number) => `Platz ${rank}`,
    top: 'Deine Nummer 1',
    minutes: 'Minuten',
    plays: 'Streams',
    month: 'Top-Monat',
    tracks: 'Songs',
  },
  en: {
    artists: 'Top artists', songs: 'Top songs', albums: 'Top albums',
    place: (rank: number) => `Number ${rank}`,
    top: 'Your number 1',
    minutes: 'Minutes',
    plays: 'Streams',
    month: 'Top month',
    tracks: 'Songs',
  },
})

/** Half-round notches cut into two corners (where the ticket tears off its stub). */
function notches(edge: '0' | '100%'): CSSProperties {
  const mask = ['0', '100%'].map((side) => `radial-gradient(circle at ${side} ${edge}, transparent 13px, #000 13.5px) ${side} 0 / 51% 100% no-repeat`).join(', ')
  return { mask, WebkitMask: mask }
}

/** A barcode's bar widths, from the name (the same name, the same code). */
function barcode(name: string) {
  return Array.from({ length: 34 }, (_, index) => 1 + ((name.charCodeAt(index % Math.max(1, name.length)) || 7) * (index + 3)) % 4)
}

/**
 * A ticket, slightly tilted: the picture with the place stamped on it, the name, and a stub to tear off with the
 * numbers and a strip of twelve dots, one per month, as big as the month was. A barcode when there are no months.
 */
export default {
  id: 'spotlight-ticket',
  topic: 'spotlight',
  series: ['artists', 'songs', 'albums'],
  Component: ({ data, look, palette, spot }) => {
    const t = useMessages(messages)
    const { number, shortMonth } = useFormats()
    const subject = useSubject(data, spot, 480)
    const first = subject.rank === 0
    const peak = subject.peakMonth
    const ink = onAccent(palette)
    const max = Math.max(1, ...subject.months)
    const stats: Array<[string, string]> = [
      [t.minutes, number.format(subject.minutes)],
      [t.plays, number.format(subject.plays)],
      ...(peak !== null ? [[t.month, shortMonth.format(new Date(Date.UTC(data.year, peak, 1)))] as [string, string]] : []),
      ...(subject.series !== 'songs' && subject.tracks > 0 ? [[t.tracks, number.format(subject.tracks)] as [string, string]] : []),
    ]
    return (
      <Body className="items-center justify-center gap-5">
        <In from={first ? 'zoom' : 'fall'}>
          <Headline look={look} className={`text-center ${first ? 'text-4xl' : 'text-3xl'}`}>
            {first ? t.top : t.place(subject.rank + 1)}
          </Headline>
        </In>
        <div className="w-full max-w-[20rem] -rotate-3">
          <In from={first ? 'spin' : 'left'} delay={200} className="relative">
            <div className="rounded-t-2xl p-3 pb-5 shadow-2xl" style={{ background: palette.accent, color: ink, ...notches('100%') }}>
              <Picture src={subject.image} className="h-44 w-full rounded-lg sm:h-52" />
              <div className="mt-3 px-1">
                <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-widest uppercase opacity-75">
                  <span className="truncate">{t[subject.series]}</span>
                  <span className="shrink-0 tabular-nums">
                    {subject.rank + 1}/{spot?.count ?? subject.rank + 1} · {data.year}
                  </span>
                </div>
                <Headline look={look} className="mt-1 line-clamp-2 text-2xl break-words">
                  {subject.name}
                </Headline>
                {subject.by && <div className="mt-0.5 truncate text-sm font-bold">{subject.by}</div>}
              </div>
            </div>
            {/* The place, stamped onto the picture's corner. */}
            <div
              aria-hidden
              className={`wrapped-spot-stamp absolute -top-4 -right-4 grid place-items-center rounded-full shadow-lg ${first ? 'size-24' : 'size-20'}`}
              style={{ background: ink, color: palette.accent, animationDelay: first ? '1100ms' : '900ms' }}
            >
              <div className="absolute inset-1.5 rounded-full border-2 border-dashed" style={{ borderColor: palette.accent }} />
              <span className={`leading-none ${displayClass(look)} ${first ? 'text-5xl' : 'text-4xl'}`}>{subject.rank + 1}</span>
            </div>
          </In>
          <In delay={600} className="translate-x-1 rotate-2">
            <div className="rounded-b-2xl border-t-2 border-dashed px-4 pt-4 pb-3 shadow-2xl" style={{ background: palette.accent, color: ink, borderColor: `color-mix(in srgb, ${ink} 45%, transparent)`, ...notches('0') }}>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                {stats.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <div className="truncate text-[10px] font-bold tracking-wide uppercase opacity-75">{label}</div>
                    <div className={`truncate text-lg leading-tight tabular-nums ${displayClass(look)}`}>{value}</div>
                  </div>
                ))}
              </div>
              {peak !== null ? (
                <div className="mt-3 flex justify-between" aria-hidden>
                  {subject.months.map((value, index) => (
                    <div key={index} className="flex w-5 flex-col items-center gap-1">
                      <div className="grid size-5 place-items-center">
                        <span
                          className="animate-in zoom-in-0 fill-mode-both rounded-full duration-500"
                          style={{
                            width: 4 + (value / max) * 16,
                            height: 4 + (value / max) * 16,
                            background: ink,
                            opacity: value > 0 ? 1 : 0.3,
                            boxShadow: index === peak ? `0 0 0 2px ${palette.accent}, 0 0 0 4px ${ink}` : undefined,
                            animationDelay: `${900 + index * 60}ms`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-bold uppercase opacity-75">{shortMonth.format(new Date(Date.UTC(data.year, index, 1))).slice(0, 1)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex h-9 items-stretch gap-[2px] overflow-hidden" aria-hidden>
                  {barcode(subject.name).map((width, index) => (
                    <span key={index} className="shrink-0" style={{ width, background: index % 2 ? 'transparent' : ink }} />
                  ))}
                </div>
              )}
            </div>
          </In>
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
