import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Keinen Tag ohne Musik', days: (days: number) => `${days} Tage am Stück`, span: (from: string, to: string) => `vom ${from} bis zum ${to}` },
  en: { lead: 'Not a day without music', days: (days: number) => `${days} days in a row`, span: (from: string, to: string) => `from ${from} to ${to}` },
})

/** The longest run of days as a chain of links lighting up one after another. */
export default {
  id: 'streak-chain',
  topic: 'streak',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { day } = useFormats()
    const streak = data.streak!
    const links = Math.min(streak.days, 60)
    return (
      <Body className="justify-center gap-6">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {Array.from({ length: links }, (_, index) => (
            <span
              key={index}
              className="h-4 w-7 animate-in fade-in-0 rounded-full border-[3px] fill-mode-both"
              style={{ borderColor: palette.accent, animationDelay: `${200 + index * 30}ms`, animationDuration: '300ms', marginLeft: index % 10 ? -6 : 0 }}
            />
          ))}
        </div>
        <In delay={400 + links * 30}>
          <Headline look={look} className="text-6xl">
            {t.days(streak.days)}
          </Headline>
          <p className="mt-3 text-lg font-semibold">{t.span(day.format(new Date(`${streak.from}T00:00:00Z`)), day.format(new Date(`${streak.to}T00:00:00Z`)))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
