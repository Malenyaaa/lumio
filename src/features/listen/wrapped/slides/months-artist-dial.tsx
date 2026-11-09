import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Picture, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: (name: string) => `${name} war das ganze Jahr dabei.`, peak: 'Monat mit den meisten Streams:' },
  en: { lead: (name: string) => `${name} was with you all year.`, peak: 'Month with the most streams:' },
})

/** The top artist's photo in a dial of months, a marker on the month they were heard most (2023). */
export default {
  id: 'months-artist-dial',
  topic: 'months',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { month, shortMonth } = useFormats()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 480)
    return (
      <Body className="items-center justify-center gap-6 text-center">
        <In>
          <Headline look={look} className="text-3xl">
            {t.lead(top.name)}
          </Headline>
        </In>
        <In delay={200} from="spin" className="relative grid size-72 place-items-center">
          <div aria-hidden className="wrapped-spin absolute inset-6 rounded-full opacity-80 blur-sm" style={{ background: `conic-gradient(from 0deg, ${palette.accent}, #22e1ff, #ff3bd4, #f5ff00, ${palette.accent})` }} />
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className="absolute text-[11px] font-black uppercase"
              style={{ transform: `rotate(${index * 30}deg) translateY(-8.4rem) rotate(${-index * 30}deg)` }}
            >
              {index === top.peakMonth ? (
                <span className="grid size-7 place-items-center rounded-full bg-black text-white ring-2 ring-white">●</span>
              ) : (
                shortMonth.format(new Date(Date.UTC(data.year, index, 1)))
              )}
            </span>
          ))}
          <Picture src={photo} round className="relative size-40" />
        </In>
        <In delay={700}>
          <p className="text-base font-semibold">{t.peak}</p>
          <p className="text-2xl font-black">{month.format(new Date(Date.UTC(data.year, top.peakMonth, 1)))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
