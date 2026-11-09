import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Ein Tag, ein Song.', line: (title: string, date: string) => `„${title}“, am ${date}. Wir haben mitgezählt:` },
  en: { lead: 'One day, one song.', line: (title: string, date: string) => `“${title}”, on ${date}. We kept count:` },
})

/** The plays of the day's song as tally marks, drawn one bundle after another. */
export default {
  id: 'repeat-tally',
  topic: 'repeat',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { day } = useFormats()
    const track = data.onRepeat!
    const bundles = Math.ceil(Math.min(track.plays, 40) / 5)
    return (
      <Body className="justify-center gap-6">
        <In>
          <Headline look={look} className="text-5xl">
            {t.lead}
          </Headline>
        </In>
        <In delay={200}>
          <p className="text-lg font-semibold">{t.line(track.title, day.format(new Date(`${track.date}T00:00:00Z`)))}</p>
        </In>
        <div className="flex flex-wrap gap-x-5 gap-y-3" aria-label={String(track.plays)}>
          {Array.from({ length: bundles }, (_, bundle) => {
            const marks = Math.min(5, Math.min(track.plays, 40) - bundle * 5)
            return (
              <svg key={bundle} viewBox="0 0 60 50" className="h-12 w-14" fill="none" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" aria-hidden>
                {Array.from({ length: Math.min(4, marks) }, (_, mark) => (
                  <path key={mark} d={`M${8 + mark * 12} 5 L${8 + mark * 12} 45`} className="wrapped-draw" style={{ animationDelay: `${500 + (bundle * 5 + mark) * 90}ms`, animationDuration: '400ms' }} />
                ))}
                {marks === 5 && <path d="M2 40 L54 10" className="wrapped-draw" style={{ animationDelay: `${500 + (bundle * 5 + 4) * 90}ms`, animationDuration: '400ms' }} />}
              </svg>
            )
          })}
        </div>
        <In delay={700 + bundles * 450}>
          <Headline look={look} className="text-7xl">
            {track.plays}×
          </Headline>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
