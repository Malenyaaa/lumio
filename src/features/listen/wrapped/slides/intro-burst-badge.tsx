import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, onAccent, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Bereit für dein Wrapped?', cta: 'Los geht’s' },
  en: { title: 'Ready for your Wrapped?', cta: 'Let’s go' },
})

/** The year's last two digits on a turning starburst ringed with dots (2022's teaser). */
export default {
  id: 'intro-burst-badge',
  topic: 'intro',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    return (
      <Body className="items-center justify-center gap-10 text-center">
        <In from="spin" className="relative grid size-64 place-items-center">
          {Array.from({ length: 16 }, (_, index) => (
            <span
              key={index}
              aria-hidden
              className="absolute size-3 rounded-full"
              style={{ background: palette.accent, transform: `rotate(${index * 22.5}deg) translateY(-8.5rem)` }}
            />
          ))}
          <div aria-hidden className="wrapped-burst wrapped-spin absolute inset-4" style={{ background: palette.accent }} />
          <span className="relative font-[Archivo_Black] text-8xl" style={{ color: onAccent(palette) }}>
            {String(data.year).slice(-2)}
          </span>
        </In>
        <In delay={400}>
          <Headline look={look} className="text-4xl">
            {t.title}
          </Headline>
        </In>
        <In delay={800}>
          <span className="inline-block rounded-full bg-black px-6 py-3 text-sm font-bold tracking-[0.2em] text-white uppercase">{t.cta}</span>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
