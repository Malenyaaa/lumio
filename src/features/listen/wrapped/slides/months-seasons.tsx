import { IconFlower, IconLeaf, IconSnowflake, IconSun } from '@tabler/icons-react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, onAccent, useFormats, type WrappedSlide } from '../slide-kit'

type Season = 'winter' | 'spring' | 'summer' | 'autumn'

const messages = defineMessages({
  de: {
    lead: 'Dein Jahr in vier Jahreszeiten',
    winter: 'Winter',
    spring: 'Frühling',
    summer: 'Sommer',
    autumn: 'Herbst',
    winterChild: 'Du bist ein Winterkind.',
    springChild: 'Du bist ein Frühlingskind.',
    summerChild: 'Du bist ein Sommerkind.',
    autumnChild: 'Du bist ein Herbstkind.',
    minutes: (value: string) => `${value} Min.`,
  },
  en: {
    lead: 'Your year in four seasons',
    winter: 'Winter',
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    winterChild: 'You’re a winter child.',
    springChild: 'You’re a spring child.',
    summerChild: 'You’re a summer child.',
    autumnChild: 'You’re an autumn child.',
    minutes: (value: string) => `${value} min`,
  },
})

/** The seasons' months (0 = January): the winter is the year's own December with its January and February. */
const SEASONS: Array<{ season: Season; months: number[]; Icon: typeof IconSun }> = [
  { season: 'winter', months: [11, 0, 1], Icon: IconSnowflake },
  { season: 'spring', months: [2, 3, 4], Icon: IconFlower },
  { season: 'summer', months: [5, 6, 7], Icon: IconSun },
  { season: 'autumn', months: [8, 9, 10], Icon: IconLeaf },
]

/**
 * The year as four bands, one per season, each as tall as its share of the minutes, sliding in one after another
 * with its minutes and its top artist; the strongest season in the accent and named in the headline.
 */
export default {
  id: 'months-seasons',
  topic: 'months',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const seasons = SEASONS.map(({ season, months, Icon }) => {
      const minutes = months.reduce((sum, month) => sum + (data.months[month] ?? 0), 0)
      let top: { name: string; minutes: number } | null = null
      for (const artist of data.topArtists) {
        const heard = months.reduce((sum, month) => sum + (artist.months[month] ?? 0), 0)
        if (heard > (top?.minutes ?? 0)) top = { name: artist.name, minutes: heard }
      }
      return { season, minutes, top, Icon }
    })
    const total = Math.max(1, seasons.reduce((sum, entry) => sum + entry.minutes, 0))
    const strongest = seasons.reduce((best, entry) => (entry.minutes > best.minutes ? entry : best), seasons[2]!)
    const ink = onAccent(palette)
    return (
      <Body className="gap-4">
        <In>
          <p className="text-lg font-bold">{t.lead}</p>
          <Headline look={look} className="mt-1 text-4xl break-words" delay={150}>
            {t[`${strongest.season}Child`]}
          </Headline>
        </In>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {seasons.map(({ season, minutes, top, Icon }, index) => {
            const strong = season === strongest.season
            return (
              <div
                key={season}
                className="wrapped-grow-x relative flex min-h-16 items-center gap-3 overflow-hidden rounded-xl px-4"
                // Each band its share of the height (the smallest still big enough for its line).
                style={{ flex: `${0.4 + (minutes / total) * 4} 1 0`, background: strong ? palette.accent : 'color-mix(in srgb, currentColor 14%, transparent)', color: strong ? ink : undefined, animationDelay: `${500 + index * 180}ms` }}
              >
                <Icon className="size-7 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xl leading-tight font-black">{t[season]}</p>
                  {top && <p className="truncate text-sm font-semibold opacity-85">{top.name}</p>}
                </div>
                <p className="shrink-0 text-lg font-black tabular-nums">{t.minutes(number.format(minutes))}</p>
              </div>
            )
          })}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
