import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Picture, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Am meisten gehört hast du', stats: (minutes: string, plays: string) => `${minutes} Minuten · ${plays} Streams` },
  en: { lead: 'You listened most to', stats: (minutes: string, plays: string) => `${minutes} minutes · ${plays} streams` },
})

/** The photo inside a turning starburst ringed with dots (2022). */
export default {
  id: 'top-artist-starburst',
  topic: 'top-artist',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 720)
    return (
      <Body className="justify-center gap-7">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <In delay={150} from="spin" className="relative grid size-72 place-items-center self-center">
          <div aria-hidden className="wrapped-burst wrapped-spin absolute inset-0" style={{ background: palette.accent }} />
          {Array.from({ length: 20 }, (_, index) => (
            <span key={index} aria-hidden className="absolute size-2.5 rounded-full bg-current" style={{ transform: `rotate(${index * 18}deg) translateY(-9.6rem)` }} />
          ))}
          <Picture src={photo} className="relative size-44 rounded-none" />
        </In>
        <In delay={500}>
          <Headline look={look} className="text-5xl break-words">
            {top.name}
          </Headline>
          <p className="mt-3 text-lg font-semibold opacity-85">{t.stats(number.format(top.minutes), number.format(top.plays))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
