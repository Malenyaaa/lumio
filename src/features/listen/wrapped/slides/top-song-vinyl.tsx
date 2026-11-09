import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Lief bei dir in Dauerrotation', minutes: (plays: string, minutes: string) => `${plays} Streams · ${minutes} Minuten` },
  en: { lead: 'On heavy rotation for you', minutes: (plays: string, minutes: string) => `${plays} streams · ${minutes} minutes` },
})

/** A record sliding half out of its sleeve (the cover) and spinning. */
export default {
  id: 'top-song-vinyl',
  topic: 'top-song',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const track = data.topTracks[0]!
    const cover = useTrackCover(track, 480)
    return (
      <Body className="justify-center gap-8">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <div className="relative h-56">
          <div className="absolute top-2 left-[22%] size-52 animate-in slide-in-from-left-24 duration-1000 fill-mode-both [animation-delay:500ms]">
            <div className="wrapped-spin-fast size-full rounded-full shadow-2xl" style={{ background: 'repeating-radial-gradient(circle, #111 0 2px, #1d1d1d 2px 4px)' }}>
              <div className="absolute inset-[32%] overflow-hidden rounded-full" style={{ background: palette.accent }}>
                {cover && <FadeImage src={cover} alt="" className="size-full object-cover opacity-90" />}
              </div>
              <div className="absolute inset-[48%] rounded-full bg-black" />
            </div>
          </div>
          <In from="left" className="absolute top-0 left-0 size-56 overflow-hidden rounded-sm bg-black/30 shadow-2xl">
            {cover && <FadeImage src={cover} alt="" className="size-full object-cover" />}
          </In>
        </div>
        <In delay={900}>
          <Headline look={look} className="text-4xl break-words">
            {track.title}
          </Headline>
          {track.artist && <p className="mt-1 text-xl font-bold">{track.artist}</p>}
          <p className="mt-3 text-base font-semibold">{t.minutes(number.format(track.plays), number.format(track.minutes))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
