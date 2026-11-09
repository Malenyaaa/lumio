import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, Picture, displayClass, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { artists: 'Top-Künstler*innen', songs: 'Top-Songs', minutes: 'Minuten gehört', streams: 'Streams' },
  en: { artists: 'Top artists', songs: 'Top songs', minutes: 'Minutes listened', streams: 'Streams' },
})

/** The share card: the top artist's photo on a starburst, two top-5 lists, two big numbers (2022). */
export default {
  id: 'summary-card',
  topic: 'summary',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const photo = useArtistImage(data.topArtists[0]?.name, 480)
    return (
      <Body className="justify-center pb-24">
        <In from="zoom" className="overflow-hidden rounded-2xl shadow-2xl" style={{ background: '#2a0a52', color: '#fff' }}>
          <div className="relative grid h-44 place-items-center overflow-hidden" style={{ background: palette.accent }}>
            <div aria-hidden className="wrapped-burst wrapped-spin absolute size-64 bg-black/80" />
            <Picture src={photo} className="relative size-28 rounded-none" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-5">
            {[
              [t.artists, data.topArtists.slice(0, 5).map((artist) => artist.name)],
              [t.songs, data.topTracks.slice(0, 5).map((track) => track.title)],
            ].map(([label, list]) => (
              <div key={label as string} className="min-w-0">
                <p className="text-xs opacity-70">{label as string}</p>
                <ol className="mt-1 space-y-0.5">
                  {(list as string[]).map((name, index) => (
                    <li key={name} className="truncate text-sm font-bold text-[#f1ff47]">
                      {index + 1} {name}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div>
              <p className="text-xs opacity-70">{t.minutes}</p>
              <p className={`text-3xl text-[#f1ff47] tabular-nums ${displayClass(look)}`}>{number.format(data.minutes)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">{t.streams}</p>
              <p className={`text-3xl text-[#f1ff47] tabular-nums ${displayClass(look)}`}>{number.format(data.plays)}</p>
            </div>
          </div>
          <p className="border-t border-white/15 px-5 py-2.5 text-xs font-bold tracking-[0.2em] uppercase">Lumio Wrapped {data.year}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
