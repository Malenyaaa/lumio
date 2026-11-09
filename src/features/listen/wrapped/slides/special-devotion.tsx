import { IconCrownFilled } from '@tabler/icons-react'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../specials-a.css'
import { accentText, Body, Headline, In, monthlyCrowns, onAccent, Picture, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'
import type { Wrapped } from '../wrapped-data'

const ORDINALS = {
  de: ['', '', 'zweite', 'dritte', 'vierte', 'fünfte'],
  en: ['', '', 'second', 'third', 'fourth', 'fifth'],
}

const messages = defineMessages({
  de: {
    lead: 'Ganz schön treu',
    every: (nth: number) => `Jede ${ORDINALS.de[nth]} Minute gehörte`,
    most: 'Mehr als die Hälfte deiner Zeit gehörte',
    share: (percent: number) => `${percent} % deiner ganzen Musikzeit`,
    crowns: (count: number, name: string) => `In ${count} Monaten war ${name} deine Nummer eins.`,
  },
  en: {
    lead: 'Quite the loyal fan',
    every: (nth: number) => `Every ${ORDINALS.en[nth]} minute belonged to`,
    most: 'More than half your time belonged to',
    share: (percent: number) => `${percent}% of all your listening`,
    crowns: (count: number, name: string) => `${name} was your number one in ${count} months.`,
  },
})

/** The top artist's share of the year and the months they were number one in. */
function loyalty(data: Wrapped) {
  const top = data.topArtists[0]
  if (!top || data.minutes <= 0) return { share: 0, crowns: [] as boolean[], worn: 0 }
  const crowns = monthlyCrowns(data).map((crown) => crown?.name === top.name)
  return { share: top.minutes / data.minutes, crowns, worn: crowns.filter(Boolean).length }
}

/**
 * Loyalty to one artist: their photo inside a ring filled by their share of the year ("every fourth minute"), and/or
 * a row of the twelve months with a crown for each they were number one in. For a top artist with a fifth of all
 * minutes or eight crowns.
 */
export default {
  id: 'special-devotion',
  topic: 'special',
  special: (data) => {
    const { share, worn } = loyalty(data)
    return share >= 0.2 || worn >= 8 ? Math.min(3, Math.max(share / 0.2, worn / 8)) : 0
  },
  after: 'top-artists',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { shortMonth } = useFormats()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 480)
    const { share, crowns, worn } = loyalty(data)
    const byShare = share >= 0.2
    const nth = Math.min(5, Math.max(2, Math.round(1 / Math.max(share, 0.01))))
    const percent = Math.round(share * 100)
    return (
      <Body className="justify-center gap-4">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <In delay={150} from="zoom" className="relative mx-auto size-44 shrink-0">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="7" />
            {byShare && (
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={palette.accent}
                strokeWidth="7"
                strokeLinecap="round"
                pathLength="100"
                className="wrapped-sa-arc"
                style={{ strokeDasharray: `${percent} 100`, animationDelay: '600ms' }}
              />
            )}
          </svg>
          <Picture src={photo} round className="absolute inset-[11%]" />
          {byShare && (
            <span className="absolute -right-1 bottom-2 rounded-full px-3 py-1 text-xl font-black tabular-nums shadow-xl" style={{ background: palette.accent, color: onAccent(palette) }}>
              {percent} %
            </span>
          )}
        </In>
        <In delay={500}>
          <Headline look={look} className="text-3xl break-words">
            {byShare ? (
              <>
                {share > 0.5 ? t.most : t.every(nth)}{' '}
                <span style={{ color: accentText(palette) }}>{top.name}</span>
              </>
            ) : (
              <span style={{ color: accentText(palette) }}>{top.name}</span>
            )}
          </Headline>
          {byShare && <p className="mt-2 font-semibold">{t.share(percent)}</p>}
        </In>
        {worn >= 8 && (
          <In delay={900}>
            <p className="mb-3 font-semibold">{t.crowns(worn, top.name)}</p>
            <div className="grid grid-cols-12 gap-1" aria-hidden>
              {crowns.map((crowned, month) => (
                <div key={month} className="flex flex-col items-center gap-1">
                  <span className="wrapped-pop flex h-6 items-end" style={{ animationDelay: `${1100 + month * 70}ms` }}>
                    {crowned ? <IconCrownFilled className="size-5" style={{ color: accentText(palette) }} /> : <span className="mb-1 size-1.5 rounded-full bg-current opacity-30" />}
                  </span>
                  <span className="text-[10px] font-bold uppercase">{shortMonth.format(new Date(Date.UTC(data.year, month, 1))).slice(0, 1)}</span>
                </div>
              ))}
            </div>
          </In>
        )}
      </Body>
    )
  },
} satisfies WrappedSlide
