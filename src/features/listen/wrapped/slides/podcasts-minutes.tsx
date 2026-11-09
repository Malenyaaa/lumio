import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: (minutes: string) => `${minutes} Minuten Podcasts. Deine Favoriten:`, minutes: (value: string) => `${value} Min.` },
  en: { title: (minutes: string) => `${minutes} minutes of podcasts. Your favorites:`, minutes: (value: string) => `${value} min` },
})

/** Podcast minutes as their own stat in a wide face, the shows on bars growing to their share (2025). */
export default {
  id: 'podcasts-minutes',
  topic: 'podcasts',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const total = data.topPodcasts.reduce((sum, podcast) => sum + podcast.minutes, 0)
    const max = Math.max(1, ...data.topPodcasts.map((podcast) => podcast.minutes))
    return (
      <>
        <div aria-hidden className="wrapped-checker absolute inset-x-0 top-0 h-24 opacity-15" />
        <Body className="justify-center gap-7">
          <In>
            <Headline look={look} className="text-4xl">
              {t.title(number.format(total))}
            </Headline>
          </In>
          <div className="space-y-4">
            {data.topPodcasts.map((podcast, index) => (
              <In key={podcast.name} delay={300 + index * 200} from="fade">
                <p className="truncate text-lg font-extrabold">{podcast.name}</p>
                <div className="mt-1 flex items-center gap-3">
                  <div className="wrapped-grow-x h-3 rounded-full" style={{ width: `${(podcast.minutes / max) * 80}%`, background: palette.accent, animationDelay: `${400 + index * 200}ms` }} />
                  <span className="shrink-0 text-sm font-bold">{t.minutes(number.format(podcast.minutes))}</span>
                </div>
              </In>
            ))}
          </div>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
