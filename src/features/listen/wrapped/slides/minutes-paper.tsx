import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { label: 'Minuten gehört', note: (day: string, minutes: string) => `Dein lautester Tag: ${day} – ${minutes} Minuten.`, next: 'Weiter so' },
  en: { label: 'minutes listened', note: (day: string, minutes: string) => `Your loudest day: ${day} – ${minutes} minutes.`, next: 'Keep going' },
})

/** A crumpled sheet of paper with the number in huge condensed type, a torn label and a slanted tag (2026's scrapbook). */
export default {
  id: 'minutes-paper',
  topic: 'minutes',
  Component: ({ data, palette, active }) => {
    const t = useMessages(messages)
    const { number, day } = useFormats()
    const minutes = useCountUp(data.minutes, active, 1200, 500)
    return (
      <Body className="justify-center">
        <In from="zoom" className="relative -rotate-2 rounded-sm p-7 pb-10 text-[#141414] shadow-2xl" style={{ background: '#bddc64' }}>
          <div aria-hidden className="wrapped-grain absolute inset-0 opacity-25 mix-blend-multiply" />
          <p className="relative inline-block -rotate-1 bg-white px-3 py-1 text-sm font-semibold tracking-wide uppercase shadow">{t.label}</p>
          <p className="relative mt-4 font-[Archivo_Black] text-[clamp(2.5rem,17vw,4.6rem)] sm:text-[4.2rem] leading-[0.85] tracking-tighter tabular-nums">{number.format(minutes)}</p>
          {data.topDay && (
            <p className="relative mt-5 text-base font-semibold">
              {t.note(day.format(new Date(`${data.topDay.date}T00:00:00Z`)), number.format(data.topDay.minutes))}
            </p>
          )}
          <span aria-hidden className="absolute -top-4 -right-3 text-5xl drop-shadow">★</span>
          <span aria-hidden className="absolute -bottom-3 left-6 text-3xl drop-shadow">★</span>
        </In>
        <In delay={900} from="right" className="mt-8 self-end">
          <span className="inline-block -skew-x-6 px-5 py-2 text-lg font-black tracking-wide text-white uppercase shadow-lg" style={{ background: palette.accent }}>
            {t.next} →
          </span>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
