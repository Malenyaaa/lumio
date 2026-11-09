import { useMemo } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { random } from '../deck'
import { Body, Headline, In, Stagger, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { line: (year: number) => `${year} ist vorbei. Zeit für einen Blick zurück auf deine Musik.` },
  en: { line: (year: number) => `${year} is done. Time to look back at your music.` },
})

/** A night sky of twinkling dots, one sentence in the middle (2022's genre intro). */
export default {
  id: 'intro-starfield',
  topic: 'intro',
  backdrop: false,
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    const stars = useMemo(() => {
      const next = random(data.year)
      return Array.from({ length: 70 }, () => ({ x: next() * 100, y: next() * 100, size: 1 + next() * 2.5, delay: next() * 3 }))
    }, [data.year])
    return (
      <>
        <div aria-hidden className="absolute inset-0 bg-black/85" />
        {stars.map((star, index) => (
          <span
            key={index}
            aria-hidden
            className="absolute animate-pulse rounded-full bg-white"
            style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, animationDelay: `${star.delay}s` }}
          />
        ))}
        <Body className="items-center justify-center text-center text-white">
          <In from="zoom">
            <Headline look={look} className="text-7xl">
              {data.year}
            </Headline>
          </In>
          <Headline look={look} className="mt-6 text-3xl">
            <Stagger text={t.line(data.year)} delay={400} step={90} />
          </Headline>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
