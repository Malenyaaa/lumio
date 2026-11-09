import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, inHours, onAccent, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    before: 'Du hast ',
    after: ' Minuten lang Musik gehört. Das sind ',
    end: ' Tage am Stück.',
    artist: (name: string) => `Am meisten davon mit ${name}.`,
  },
  en: {
    before: 'You listened to music for ',
    after: ' minutes. That’s ',
    end: ' days straight.',
    artist: (name: string) => `Most of it with ${name}.`,
  },
})

/** One big sentence, the numbers on marker bars (2021's highlighted words, 2025's heavy numbers). */
export default {
  id: 'minutes-highlight-sentence',
  topic: 'minutes',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const mark = { background: palette.accent, color: onAccent(palette) }
    return (
      <Body className="justify-center gap-8">
        <In>
          <Headline look={look} className="text-[2.6rem] leading-[1.12]">
            {t.before}
            <span className="wrapped-highlight rounded-md" style={mark}>
              {number.format(data.minutes)}
            </span>
            {t.after}
            <span className="wrapped-highlight rounded-md" style={mark}>
              {number.format(inHours(data.minutes).days)}
            </span>
            {t.end}
          </Headline>
        </In>
        {data.topArtists[0] && (
          <In delay={900}>
            <p className="text-xl font-bold opacity-85">{t.artist(data.topArtists[0].name)}</p>
          </In>
        )}
      </Body>
    )
  },
} satisfies WrappedSlide
