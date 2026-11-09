import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Dein Hörtyp',
    explorer: 'Entdecker*in',
    explorerWhy: (percent: number) => `${percent} % deiner Streams waren Songs, die du vorher nie gehört hattest. Immer auf der Suche nach Neuem.`,
    loyal: 'Gewohnheitstier',
    loyalWhy: (percent: number) => `${percent} % deiner Streams waren alte Bekannte. Du weißt, was du liebst.`,
    balanced: 'Gleichgewicht',
    balancedWhy: (percent: number) => `Halb neu, halb vertraut: ${percent} % deiner Streams kanntest du schon.`,
  },
  en: {
    lead: 'Your listening type',
    explorer: 'Explorer',
    explorerWhy: (percent: number) => `${percent}% of your streams were songs you had never heard before. Always after something new.`,
    loyal: 'Creature of habit',
    loyalWhy: (percent: number) => `${percent}% of your streams were old friends. You know what you love.`,
    balanced: 'In balance',
    balancedWhy: (percent: number) => `Half new, half familiar: you knew ${percent}% of your streams already.`,
  },
})

/** What kind of listener: new songs or old friends, on a spiky gradient tunnel (2022's personality). */
export function personality(repeatShare: number) {
  return repeatShare < 0.35 ? 'explorer' : repeatShare > 0.65 ? 'loyal' : 'balanced'
}

export default {
  id: 'personality-tunnel',
  topic: 'personality',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const kind = personality(data.repeatShare)
    const known = Math.round(data.repeatShare * 100)
    const why = kind === 'explorer' ? t.explorerWhy(100 - known) : kind === 'loyal' ? t.loyalWhy(known) : t.balancedWhy(known)
    return (
      <Body className="items-center justify-center gap-6 text-center">
        <div aria-hidden className="relative grid size-72 place-items-center">
          {[0, 1, 2, 3, 4].map((ring) => (
            <div
              key={ring}
              className="wrapped-burst absolute animate-in zoom-in-0 fade-in-0 duration-1000 fill-mode-both"
              style={{
                inset: `${ring * 12}%`,
                background: ring % 2 ? palette.accent : '#12d861',
                opacity: 1 - ring * 0.12,
                rotate: `${ring * 9}deg`,
                animationDelay: `${ring * 150}ms`,
              }}
            />
          ))}
          <span className="relative text-5xl">✦</span>
        </div>
        <In delay={800}>
          <p className="text-sm font-bold tracking-[0.25em] uppercase">{t.lead}</p>
          <Headline look={look} className="mt-2 text-5xl">
            {t[kind]}
          </Headline>
        </In>
        <In delay={1100}>
          <p className="text-lg font-semibold">{why}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
