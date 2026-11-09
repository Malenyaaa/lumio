import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, type WrappedSlide, useFormats } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Dein Musikjahr', artists: 'Künstler*innen', songs: 'Songs', total: 'Summe', minutes: 'Minuten', streams: 'Streams', thanks: 'Danke fürs Zuhören!' },
  en: { title: 'Your year in music', artists: 'Artists', songs: 'Songs', total: 'Total', minutes: 'Minutes', streams: 'Streams', thanks: 'Thank you for listening!' },
})

/** A till receipt printing itself line by line: the top artists and songs as items, the minutes as the total. */
export default {
  id: 'summary-receipt',
  topic: 'summary',
  Component: ({ data }) => {
    const t = useMessages(messages)
    const { number, compact } = useFormats()
    const lines: Array<[string, string] | 'rule' | string> = [
      t.artists,
      ...data.topArtists.slice(0, 5).map((artist, index): [string, string] => [`${index + 1} ${artist.name}`, compact.format(artist.minutes)]),
      'rule',
      t.songs,
      ...data.topTracks.slice(0, 5).map((track, index): [string, string] => [`${index + 1} ${track.title}`, `${track.plays}×`]),
      'rule',
      [t.streams, number.format(data.plays)],
    ]
    return (
      <Body className="items-center justify-center pb-24">
        <div className="w-full max-w-xs overflow-hidden">
          <div
            className="animate-in slide-in-from-top-full duration-[1600ms] ease-out fill-mode-both bg-[#fbfbf6] px-5 pt-5 pb-8 font-mono text-[13px] text-[#1a1a1a] shadow-2xl"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), 95% 100%, 90% calc(100% - 8px), 85% 100%, 80% calc(100% - 8px), 75% 100%, 70% calc(100% - 8px), 65% 100%, 60% calc(100% - 8px), 55% 100%, 50% calc(100% - 8px), 45% 100%, 40% calc(100% - 8px), 35% 100%, 30% calc(100% - 8px), 25% 100%, 20% calc(100% - 8px), 15% 100%, 10% calc(100% - 8px), 5% 100%, 0 calc(100% - 8px))' }}
          >
            <p className="text-center text-base font-bold tracking-[0.2em] uppercase">Lumio</p>
            <p className="text-center">
              {t.title} {data.year}
            </p>
            <p className="my-2 border-t border-dashed border-black/50" />
            {lines.map((line, index) =>
              line === 'rule' ? (
                <p key={index} className="my-2 border-t border-dashed border-black/50" />
              ) : typeof line === 'string' ? (
                <p key={index} className="font-bold uppercase">
                  {line}
                </p>
              ) : (
                <p key={index} className="flex justify-between gap-3">
                  <span className="truncate">{line[0]}</span>
                  <span className="shrink-0">{line[1]}</span>
                </p>
              ),
            )}
            <p className="mt-3 flex justify-between border-t-2 border-black pt-2 text-base font-bold">
              <span>
                {t.total} ({t.minutes})
              </span>
              <span>{number.format(data.minutes)}</span>
            </p>
            <p className="mt-4 text-center">{t.thanks}</p>
            <p aria-hidden className="mt-2 text-center tracking-[-0.1em]">
              ||| || ||| | || |||| | ||| || |
            </p>
          </div>
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
