import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, Picture, displayClass, onAccent, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Nummer eins. Kein anderer Song kam so oft.', plays: (value: string) => `${value} Streams` },
  en: { lead: 'Number one. No other song came on as often.', plays: (value: string) => `${value} streams` },
})

/** The title broken over lines on marker bars, a small cover and the count beside (op-art opener). */
export default {
  id: 'top-song-highlight-bars',
  topic: 'top-song',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const track = data.topTracks[0]!
    const cover = useTrackCover(track, 320)
    const words = track.title.split(/\s+/)
    return (
      <>
        <div aria-hidden className="wrapped-checker absolute inset-x-0 bottom-0 h-28 opacity-20" />
        <Body className="justify-center gap-7">
          <In>
            <p className="text-lg font-bold">{t.lead}</p>
          </In>
          <p className={`text-5xl leading-[1.15] ${displayClass(look)}`}>
            {words.map((word, index) => (
              <span key={index}>
                <span
                  className={`wrapped-highlight inline-block ${index % 2 ? 'wrapped-slab-right' : 'wrapped-slab-left'}`}
                  style={{ background: index % 2 ? '#111' : palette.accent, color: index % 2 ? '#fff' : onAccent(palette), animationDelay: `${200 + index * 120}ms` }}
                >
                  {word}
                </span>{' '}
              </span>
            ))}
          </p>
          <In delay={300 + words.length * 120} className="flex items-center gap-4">
            <Picture src={cover} className="size-16 shrink-0" />
            <div>
              {track.artist && <p className="text-lg font-extrabold">{track.artist}</p>}
              <p className="text-sm font-semibold opacity-80">{t.plays(number.format(track.plays))}</p>
            </div>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
