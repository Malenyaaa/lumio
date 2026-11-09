import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, displayClass, onAccent, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { minutes: 'Minuten', streams: 'Streams', artists: 'Top-Künstler*innen', songs: 'Top-Songs' },
  en: { minutes: 'Minutes', streams: 'Streams', artists: 'Top artists', songs: 'Top songs' },
})

/** A poster: the year as a giant outline, the top five artists and songs on two panels, the year's numbers (op-art). */
export default {
  id: 'summary-poster',
  topic: 'summary',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { compact } = useFormats()
    const lists: Array<[string, string[]]> = [
      [t.artists, data.topArtists.slice(0, 5).map((artist) => artist.name)],
      [t.songs, data.topTracks.slice(0, 5).map((track) => track.title)],
    ]
    return (
      <>
        <div aria-hidden className="wrapped-stripes absolute inset-x-0 top-0 h-16 opacity-25" />
        <Body className="justify-center gap-3 pb-24">
          <In from="fade">
            <p className={`wrapped-outline text-[5.5rem] leading-[0.85] ${displayClass(look)}`} style={{ WebkitTextStrokeColor: palette.color }}>
              {data.year}
            </p>
          </In>
          {lists.map(([label, names], panel) => (
            <In
              key={label}
              delay={200 + panel * 180}
              from={panel ? 'right' : 'left'}
              className="rounded-xl p-3"
              style={panel ? { background: 'rgb(0 0 0 / 0.28)' } : { background: palette.accent, color: onAccent(palette) }}
            >
              <p className="text-xs font-bold tracking-wide uppercase">{label}</p>
              <ol className="mt-1 space-y-0.5">
                {names.map((name, index) => (
                  <li key={`${index}${name}`} className="flex gap-2 truncate text-base font-extrabold">
                    <span className={`w-4 shrink-0 ${displayClass(look)}`}>{index + 1}</span>
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ol>
            </In>
          ))}
          <In delay={600} className="grid grid-cols-2 gap-2">
            {[
              [t.minutes, compact.format(data.minutes)],
              [t.streams, compact.format(data.plays)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-black/20 p-3">
                <p className="text-xs font-bold tracking-wide uppercase">{label}</p>
                <p className={`text-3xl tabular-nums ${displayClass(look)}`}>{value}</p>
              </div>
            ))}
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
