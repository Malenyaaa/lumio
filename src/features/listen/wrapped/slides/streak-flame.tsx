import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, displayClass, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { unit: 'Tage in Folge', line: (from: string, to: string, active: number) => `${from} bis ${to}. Insgesamt hast du an ${active} Tagen Musik gehört.` },
  en: { unit: 'days in a row', line: (from: string, to: string, active: number) => `${from} to ${to}. In all, you listened on ${active} days.` },
})

/** The streak as a huge number in front of a flickering flame of blurred blobs (neon). */
export default {
  id: 'streak-flame',
  topic: 'streak',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { day } = useFormats()
    const streak = data.streak!
    const days = useCountUp(streak.days, active, 1200, 300)
    return (
      <>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3">
          {['#ff4d00', '#ffb800', palette.accent].map((color, index) => (
            <div
              key={color}
              className="wrapped-blob absolute bottom-[-10%] left-1/2 size-72 -translate-x-1/2 rounded-full"
              style={{ background: color, opacity: 0.7 - index * 0.15, animationDuration: `${3 + index}s`, marginLeft: (index - 1) * 50 }}
            />
          ))}
        </div>
        <Body className="justify-center gap-3">
          <p className={`text-[9rem] leading-[0.85] tabular-nums ${displayClass(look)}`}>{days}</p>
          <In delay={300}>
            <p className="text-3xl font-black">{t.unit}</p>
          </In>
          <In delay={1500}>
            <p className="mt-4 text-lg font-semibold">
              {t.line(day.format(new Date(`${streak.from}T00:00:00Z`)), day.format(new Date(`${streak.to}T00:00:00Z`)), data.activeDays)}
            </p>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
