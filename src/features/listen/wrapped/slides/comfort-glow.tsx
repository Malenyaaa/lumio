import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Egal, was war, dieser Song war da:', days: (days: number) => `${days} Tage` },
  en: { lead: 'Whatever happened, this song was there:', days: (days: number) => `${days} days` },
})

/** The cover blurred into a glowing backdrop, sharp in the middle, the days in neon. */
export default {
  id: 'comfort-glow',
  topic: 'comfort',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const track = data.comfort!
    const cover = useTrackCover(track, 480)
    return (
      <>
        {cover && <FadeImage src={cover} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl saturate-150" />}
        <div aria-hidden className="absolute inset-0 bg-black/40" />
        <Body className="items-center justify-center gap-6 text-center text-white">
          <In>
            <p className="text-lg font-bold">{t.lead}</p>
          </In>
          <In delay={200} from="zoom" className="size-56 overflow-hidden rounded-xl shadow-2xl">
            {cover && <FadeImage src={cover} alt="" className="size-full object-cover" />}
          </In>
          <In delay={400}>
            <Headline look={look} className="text-4xl">
              {track.title}
            </Headline>
            {track.artist && <p className="mt-1 text-lg font-bold opacity-85">{track.artist}</p>}
          </In>
          <In delay={900}>
            <p className="wrapped-neon text-5xl font-black" style={{ color: palette.accent }}>
              {t.days(track.days)}
            </p>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
