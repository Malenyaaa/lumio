import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Picture, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Dein Song des Jahres', plays: (value: string) => `${value}-mal gehört` },
  en: { lead: 'Your song of the year', plays: (value: string) => `Played ${value} times` },
})

/** The cover on two layered spiky stars in contrasting colors (2022). */
export default {
  id: 'top-song-burst',
  topic: 'top-song',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const track = data.topTracks[0]!
    const cover = useTrackCover(track, 720)
    return (
      <Body className="justify-center gap-7">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <In delay={150} from="spin" className="relative grid size-72 place-items-center self-center">
          <div aria-hidden className="wrapped-burst wrapped-spin absolute inset-0 bg-black" />
          <div aria-hidden className="wrapped-burst absolute inset-6 rotate-12" style={{ background: palette.accent }} />
          <Picture src={cover} className="relative size-40" />
        </In>
        <In delay={500}>
          <Headline look={look} className="text-4xl break-words">
            {track.title}
          </Headline>
          {track.artist && <p className="mt-1 text-xl font-bold opacity-85">{track.artist}</p>}
          <p className="mt-3 text-lg">{t.plays(number.format(track.plays))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
