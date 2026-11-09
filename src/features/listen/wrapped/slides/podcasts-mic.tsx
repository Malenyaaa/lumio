import { IconMicrophone2 } from '@tabler/icons-react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Zwischendurch wurde geredet', top: 'Dein Podcast des Jahres', minutes: (value: string) => `${value} Minuten zugehört` },
  en: { lead: 'In between, there was talking', top: 'Your podcast of the year', minutes: (value: string) => `${value} minutes listened` },
})

/** A microphone with sound rings pulsing out of it, the top podcast below. */
export default {
  id: 'podcasts-mic',
  topic: 'podcasts',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topPodcasts[0]!
    return (
      <Body className="items-center justify-center gap-8 text-center">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <div className="relative grid size-48 place-items-center" aria-hidden>
          {[0, 1, 2].map((ring) => (
            <span key={ring} className="absolute inset-0 animate-ping rounded-full border-4" style={{ borderColor: palette.accent, animationDelay: `${ring * 0.6}s`, animationDuration: '2.2s' }} />
          ))}
          <span className="grid size-28 place-items-center rounded-full shadow-xl" style={{ background: palette.accent }}>
            <IconMicrophone2 className="size-14 text-black" />
          </span>
        </div>
        <In delay={500}>
          <p className="text-sm font-bold tracking-[0.2em] uppercase opacity-80">{t.top}</p>
          <Headline look={look} className="mt-2 text-4xl">
            {top.name}
          </Headline>
          <p className="mt-2 text-lg font-semibold">{t.minutes(number.format(top.minutes))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
