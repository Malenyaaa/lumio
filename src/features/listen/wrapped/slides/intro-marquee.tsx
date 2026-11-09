import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Marquee, displayClass, onAccent, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { run: 'Wrapped', title: (year: number) => `Das war ${year}. Und so hat es geklungen.` },
  en: { run: 'Wrapped', title: (year: number) => `That was ${year}. Here’s how it sounded.` },
})

/** Bands of text running across the slide in turns, the year in the middle. */
export default {
  id: 'intro-marquee',
  topic: 'intro',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const band = `${t.run} ${data.year}`
    return (
      <>
        <div aria-hidden className={`absolute inset-x-0 top-24 -rotate-6 space-y-2 text-5xl ${displayClass(look)}`}>
          <Marquee text={band} className="py-1" speed={22} />
          <Marquee text={band} reverse className="py-1" speed={26} />
        </div>
        <div aria-hidden className={`absolute inset-x-0 bottom-28 rotate-6 text-5xl ${displayClass(look)}`} style={{ color: palette.accent }}>
          <Marquee text={band} className="py-1" speed={20} />
        </div>
        <Body className="justify-center">
          <In from="zoom" className="rounded-2xl p-6 shadow-2xl" style={{ background: palette.accent, color: onAccent(palette) }}>
            <Headline look={look} className="text-4xl">
              {t.title(data.year)}
            </Headline>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
