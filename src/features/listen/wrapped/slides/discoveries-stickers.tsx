import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: (count: string) => `${count} neue Namen in deiner Musik.`, top: (name: string, minutes: string) => `Ganz vorn: ${name} mit ${minutes} Minuten.` },
  en: { title: (count: string) => `${count} new names in your music.`, top: (name: string, minutes: string) => `Leading them: ${name}, with ${minutes} minutes.` },
})

/** A grid of sticker dots popping in, one per new artist (up to a sheet full), the sentence over it (2025). */
export default {
  id: 'discoveries-stickers',
  topic: 'discoveries',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const dots = Math.min(96, data.newArtists.count)
    const top = data.newArtists.top
    return (
      <Body className="justify-center gap-8">
        <div aria-hidden className="grid grid-cols-12 gap-1.5">
          {Array.from({ length: dots }, (_, index) => (
            <span
              key={index}
              className="aspect-square animate-in zoom-in-0 rounded-full fill-mode-both shadow-[2px_2px_0_#000]"
              style={{ background: index % 5 === 0 ? '#dcb301' : palette.accent, animationDelay: `${index * 18}ms`, animationDuration: '350ms' }}
            />
          ))}
        </div>
        <In delay={dots * 18 + 200}>
          <Headline look={look} className="text-4xl">
            {t.title(number.format(data.newArtists.count))}
          </Headline>
          {top && <p className="mt-3 text-lg font-semibold">{t.top(top.name, number.format(top.minutes))}</p>}
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
