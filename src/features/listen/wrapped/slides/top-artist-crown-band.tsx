import { defineMessages, useMessages } from '@/lib/i18n'
import { accentText, Body, Headline, In, Picture, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Dein*e Top-Künstler*in war', streams: (value: string) => `${value} Streams. Ganz klar die Nummer eins.` },
  en: { lead: 'Your top artist was', streams: (value: string) => `${value} streams. Clearly number one.` },
})

/** A wavy band crossing the slide behind the photo, stamped with crowns (2021). */
export default {
  id: 'top-artist-crown-band',
  topic: 'top-artist',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 720)
    return (
      <>
        <svg aria-hidden viewBox="0 0 400 700" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path d="M-40 520 C 80 420, 160 620, 260 460 S 420 260, 460 180 L 460 300 C 380 380, 320 560, 220 600 S 40 640, -40 660 Z" fill={palette.accent} className="animate-in fade-in-0 duration-1000" />
        </svg>
        {[
          [4, 86],
          [84, 90],
          [88, 12],
          [3, 14],
        ].map(([x, y], index) => (
          <span key={index} aria-hidden className="wrapped-float absolute text-4xl" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${index * -1.2}s` }}>
            ♛
          </span>
        ))}
        <Body className="gap-6">
          <In>
            <p className="text-xl font-bold">{t.lead}</p>
          </In>
          <In delay={200}>
            <Headline look={look} className="text-5xl break-words" >
              <span style={{ color: accentText(palette) }}>{top.name}</span>
            </Headline>
          </In>
          <In delay={400} from="zoom" className="self-center">
            <Picture src={photo} className="size-56 rotate-3" />
          </In>
          <In delay={800}>
            <p className="text-lg font-semibold">{t.streams(number.format(top.plays))}</p>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
