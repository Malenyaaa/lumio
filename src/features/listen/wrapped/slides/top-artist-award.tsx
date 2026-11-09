import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, Picture, displayClass, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { congrats: 'Herzlichen Glückwunsch', award: 'Künstler*in des Jahres', why: (minutes: string) => `Für ${minutes} Minuten in deinen Ohren.` },
  en: { congrats: 'Congratulations', award: 'Artist of the year', why: (minutes: string) => `For ${minutes} minutes in your ears.` },
})

/** An award: a round photo under a hand-drawn crown, the name in outlined type, a chip (2025's party awards). */
export default {
  id: 'top-artist-award',
  topic: 'top-artist',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 480)
    return (
      <>
        <div aria-hidden className="wrapped-rings absolute inset-x-0 -bottom-40 h-96 opacity-15" />
        <Body className="items-center justify-center gap-5 text-center">
          <In>
            <p className="text-sm font-bold tracking-[0.25em] uppercase opacity-80">{t.congrats}</p>
          </In>
          <In delay={200} from="zoom" className="relative">
            <svg aria-hidden viewBox="0 0 120 60" className="absolute -top-14 left-1/2 w-28 -translate-x-1/2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
              <path className="wrapped-draw" d="M10 52 L18 12 L40 36 L60 6 L80 36 L102 12 L110 52 Z" />
            </svg>
            <Picture src={photo} round className="size-48 border-4" style={{ borderColor: palette.accent }} />
          </In>
          <In delay={500}>
            <p className={`wrapped-outline text-6xl break-words ${displayClass(look)}`} style={{ WebkitTextStrokeColor: palette.accent }}>
              {top.name}
            </p>
          </In>
          <In delay={800}>
            <span className="inline-block bg-black px-3 py-1 text-sm font-bold text-white">{t.award}</span>
          </In>
          <In delay={1000}>
            <p className="text-lg font-semibold">{t.why(number.format(top.minutes))}</p>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
