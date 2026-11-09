import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, displayClass, onAccent, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { minutes: 'Minuten', streams: 'Streams', songs: 'Songs', artists: 'Künstler*innen', top: 'Ganz vorn', song: 'Song', artist: 'Künstler*in' },
  en: { minutes: 'Minutes', streams: 'Streams', songs: 'Songs', artists: 'Artists', top: 'On top', song: 'Song', artist: 'Artist' },
})

/** A poster: the year as a giant outline, a grid of tiles with the year's numbers, a striped band (op-art). */
export default {
  id: 'summary-poster',
  topic: 'summary',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { compact } = useFormats()
    const tiles: Array<[string, string]> = [
      [t.minutes, compact.format(data.minutes)],
      [t.streams, compact.format(data.plays)],
      [t.songs, compact.format(data.tracks)],
      [t.artists, compact.format(data.artists)],
    ]
    return (
      <>
        <div aria-hidden className="wrapped-stripes absolute inset-x-0 top-0 h-16 opacity-25" />
        <Body className="justify-center gap-4 pb-24">
          <In from="fade">
            <p className={`wrapped-outline text-[6.5rem] leading-[0.85] ${displayClass(look)}`} style={{ WebkitTextStrokeColor: palette.color }}>{data.year}</p>
          </In>
          <div className="grid grid-cols-2 gap-2">
            {tiles.map(([label, value], index) => (
              <In key={label} delay={200 + index * 120} from="zoom" className="rounded-xl p-3" style={index % 3 === 0 ? { background: palette.accent, color: onAccent(palette) } : { background: 'rgb(0 0 0 / 0.22)' }}>
                <p className="text-xs font-bold tracking-wide uppercase">{label}</p>
                <p className={`text-4xl tabular-nums ${displayClass(look)}`}>{value}</p>
              </In>
            ))}
          </div>
          <In delay={800} className="space-y-1 rounded-xl bg-black/20 p-3">
            <p className="text-xs font-bold tracking-wide uppercase">{t.top}</p>
            {data.topArtists[0] && (
              <p className="truncate text-lg">
                <span className="opacity-75">{t.artist}: </span>
                <span className="font-extrabold">{data.topArtists[0].name}</span>
              </p>
            )}
            {data.topTracks[0] && (
              <p className="truncate text-lg">
                <span className="opacity-75">{t.song}: </span>
                <span className="font-extrabold">{data.topTracks[0].title}</span>
              </p>
            )}
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
