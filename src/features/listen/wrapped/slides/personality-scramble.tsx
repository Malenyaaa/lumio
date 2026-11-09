import { useEffect, useState } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { random } from '../deck'
import { Body, In, displayClass, type WrappedSlide } from '../slide-kit'
import { personality } from './personality-tunnel'

const messages = defineMessages({
  de: {
    lead: 'Analyse abgeschlossen. Du bist:',
    explorer: 'Neugierig',
    loyal: 'Treu',
    balanced: 'Ausgewogen',
    stats: (known: number, artists: string) => `${known} % vertraute Songs · ${artists} Künstler*innen`,
  },
  en: {
    lead: 'Analysis complete. You are:',
    explorer: 'Curious',
    loyal: 'Loyal',
    balanced: 'Balanced',
    stats: (known: number, artists: string) => `${known}% familiar songs · ${artists} artists`,
  },
})

const GLYPHS = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** The word scrambling through random glyphs until it settles, letter by letter (text-animation kit). */
function Scramble({ text, active, seed }: { text: string; active: boolean; seed: number }) {
  const [shown, setShown] = useState(text)
  useEffect(() => {
    if (!active) return
    const next = random(seed)
    const plan = [...text].map(() => ({ start: Math.floor(next() * 12), end: 14 + Math.floor(next() * 26) }))
    let frame = 0
    const timer = window.setInterval(() => {
      frame += 1
      setShown(
        [...text]
          .map((char, index) => (frame >= plan[index]!.end || char === ' ' ? char : frame >= plan[index]!.start ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ''))
          .join(''),
      )
      if (frame > 42) window.clearInterval(timer)
    }, 45)
    return () => window.clearInterval(timer)
  }, [text, active, seed])
  return <span aria-label={text}>{shown}</span>
}

export default {
  id: 'personality-scramble',
  topic: 'personality',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const kind = personality(data.repeatShare)
    return (
      <>
        <div aria-hidden className="wrapped-dots absolute inset-0 opacity-10" />
        <Body className="justify-center gap-6">
          <In from="fade">
            <p className="font-mono text-sm opacity-80">{t.lead}</p>
          </In>
          <p className={`min-h-[1.1em] text-6xl break-words ${displayClass(look)}`} style={{ color: palette.accent }}>
            <Scramble text={t[kind]} active={active} seed={data.year} />
          </p>
          <In delay={2200}>
            <p className="font-mono text-base">{t.stats(Math.round(data.repeatShare * 100), new Intl.NumberFormat().format(data.artists))}</p>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
