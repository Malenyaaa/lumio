import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'
import { FadeImage } from '@/components/media/fade-image'

const messages = defineMessages({
  de: { lead: 'Dein erster Song des Jahres', caption: (date: string) => `aufgenommen am ${date}` },
  en: { lead: 'Your first song of the year', caption: (date: string) => `taken on ${date}` },
})

/** The cover as a polaroid, taped on, with a handwritten-looking caption and star stickers (2026's scrapbook). */
export default {
  id: 'first-song-polaroid',
  topic: 'first-song',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const track = data.firstTrack!
    const cover = useTrackCover(track, 480)
    const date = useFormats().localDay.format(track.at)
    return (
      <Body className="items-center justify-center gap-7 text-center">
        <In>
          <Headline look={look} className="text-3xl">
            {t.lead}
          </Headline>
        </In>
        <In delay={250} from="spin" className="relative rotate-[-4deg] bg-white p-3 pb-12 text-[#222] shadow-2xl">
          <span aria-hidden className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 bg-white/70 shadow-sm" />
          <div className="size-56 overflow-hidden bg-neutral-200">{cover && <FadeImage src={cover} alt="" className="size-full object-cover" />}</div>
          <p className="absolute inset-x-3 bottom-3 truncate font-serif text-lg italic">{track.title}</p>
          <span aria-hidden className="absolute -right-5 -bottom-4 text-4xl" style={{ color: palette.accent }}>
            ★
          </span>
        </In>
        <In delay={700}>
          {track.artist && <p className="text-xl font-extrabold">{track.artist}</p>}
          <p className="mt-1 text-sm">{t.caption(date)}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
