import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { eyebrow: 'Wrapped', title: 'Dein Jahr in Musik ist da.', tap: 'Tippe, um loszulegen' },
  en: { eyebrow: 'Wrapped', title: 'Your year in music is here.', tap: 'Tap to begin' },
})

/** The year huge and skewed, a line below it (an opener in the op-art style). */
export default {
  id: 'intro-skewed-year',
  topic: 'intro',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    return (
      <Body className="justify-center gap-6">
        <In from="fade">
          <p className="text-sm font-bold tracking-[0.3em] uppercase opacity-80">{t.eyebrow}</p>
        </In>
        <In delay={150} from="left">
          <Headline look={look} className="-skew-y-6 text-[8.5rem] leading-[0.8]" >
            <span style={{ color: palette.accent }}>{data.year}</span>
          </Headline>
        </In>
        <In delay={450}>
          <Headline look={look} className="text-4xl">
            {t.title}
          </Headline>
        </In>
        <In delay={1100} from="fade" className="mt-auto">
          <p className="text-sm font-semibold opacity-75">{t.tap} →</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
