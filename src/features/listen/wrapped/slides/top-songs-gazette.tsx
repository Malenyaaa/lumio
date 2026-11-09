import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { masthead: 'The Wrapped Gazette', edition: (year: number) => `Jahresausgabe ${year}`, headline: 'Die Charts des Jahres', plays: (value: string) => `${value} Streams` },
  en: { masthead: 'The Wrapped Gazette', edition: (year: number) => `Annual edition ${year}`, headline: 'The charts of the year', plays: (value: string) => `${value} streams` },
})

/** A newspaper page: masthead, rules, a serif headline, the chart as numbered entries (the gazette kit). */
export default {
  id: 'top-songs-gazette',
  topic: 'top-songs',
  Component: ({ data, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    return (
      <>
        <div aria-hidden className="absolute inset-0 bg-[#f3efe3]" />
        <div aria-hidden className="absolute inset-0 text-[#16160e] opacity-[0.07] [background:radial-gradient(circle,currentColor_1px,transparent_1px)_0_0/13px_13px]" />
        <Body className="justify-center text-[#16160e]">
          <In from="fade" className="border-b-[3px] border-double border-[#16160e] pb-2 text-center">
            <p className="font-serif text-3xl font-black tracking-tight">{t.masthead}</p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.3em] uppercase">{t.edition(data.year)}</p>
          </In>
          <In delay={200}>
            <p className="mt-5 font-serif text-4xl leading-none font-black italic">{t.headline}</p>
          </In>
          <ol className="mt-5 divide-y divide-[#16160e]/25 border-y border-[#16160e]">
            {data.topTracks.slice(0, 5).map((track, index) => (
              <li key={track.key} className="flex items-baseline gap-3 py-2.5">
                <span className="wrapped-letterpress font-serif text-3xl font-black" style={{ color: palette.accent, animationDelay: `${400 + index * 140}ms` }}>
                  {index + 1}
                </span>
                <In delay={450 + index * 140} from="fade" className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-xl font-bold">{track.title}</span>
                  <span className="block truncate font-mono text-[10px] tracking-[0.2em] uppercase">
                    {track.artist} · {t.plays(number.format(track.plays))}
                  </span>
                </In>
              </li>
            ))}
          </ol>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
