import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, partOfDay, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Deine Musik-Uhr', morning: 'Du bist ein Morgenmensch.', afternoon: 'Deine Musik gehört dem Nachmittag.', evening: 'Abends drehst du richtig auf.', night: 'Du bist eine Nachteule.' },
  en: { lead: 'Your music clock', morning: 'You’re a morning person.', afternoon: 'Your music belongs to the afternoon.', evening: 'Evenings are when you turn it up.', night: 'You’re a night owl.' },
})

/** Twenty-four bars growing one after another, the part of the day named below. */
export default {
  id: 'clock-bars',
  topic: 'clock',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const max = Math.max(1, ...data.hours)
    return (
      <Body className="justify-center gap-6">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <div aria-hidden>
          <div className="flex h-44 items-end gap-[3px]">
            {data.hours.map((minutes, hour) => (
              <div
                key={hour}
                className="wrapped-grow flex-1 rounded-t-sm"
                style={{ height: `${Math.max(3, (minutes / max) * 100)}%`, background: minutes === max ? palette.accent : 'currentColor', opacity: minutes === max ? 1 : 0.35 + 0.55 * (minutes / max), animationDelay: `${300 + hour * 35}ms` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs font-semibold opacity-75">
            {[0, 6, 12, 18, 24].map((hour) => (
              <span key={hour}>{hour}</span>
            ))}
          </div>
        </div>
        <In delay={1300}>
          <Headline look={look} className="text-4xl">
            {t[partOfDay(data.hours)]}
          </Headline>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
