import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, displayClass, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Die fünf, die dein Jahr geprägt haben', minutes: (value: string) => `${value} Min.` },
  en: { title: 'The five who shaped your year', minutes: (value: string) => `${value} min` },
})

const SLABS = [
  ['#0a0a0a', '#ff6b1f'],
  ['#e91e63', '#0a0a0a'],
  ['#ff6b1f', '#f5ff00'],
  ['#1ed760', '#0a0a0a'],
  ['#6b2fb8', '#f5ff00'],
]

/** Each name on a full-width slab of its own color, sliding in from alternate sides (neon kit). */
export default {
  id: 'top-artists-slabs',
  topic: 'top-artists',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    const { compact } = useFormats()
    return (
      <Body className="justify-center gap-5 px-0">
        <In className="px-7">
          <Headline look={look} className="text-3xl">
            {t.title}
          </Headline>
        </In>
        <div className="space-y-1.5">
          {data.topArtists.slice(0, 5).map((artist, index) => {
            const [background, color] = SLABS[index]!
            return (
              <div
                key={artist.name}
                className={`flex items-baseline justify-between gap-3 px-7 py-3 ${index % 2 ? 'wrapped-slab-right' : 'wrapped-slab-left'}`}
                style={{ background, color, animationDelay: `${250 + index * 120}ms` }}
              >
                <span className={`min-w-0 truncate text-3xl ${displayClass(look)}`}>
                  {index + 1}. {artist.name}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{t.minutes(compact.format(artist.minutes))}</span>
              </div>
            )
          })}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
