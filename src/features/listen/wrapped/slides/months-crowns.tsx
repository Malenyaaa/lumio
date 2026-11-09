import '../specials-b.css'
import { IconCrown } from '@tabler/icons-react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { accentText, Body, Headline, In, monthlyCrowns, onAccent, Picture, useArtistImage, useFormats, type Palette, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Wer trug wann die Krone?',
    many: (months: number, artists: number) => `${months} Monate, ${artists} Kronen`,
    one: 'Ein Jahr, eine Krone',
    oneLine: (name: string) => `${name} hat sie nie abgegeben.`,
    none: 'Ein Thron, viele Anwärter*innen',
  },
  en: {
    lead: 'Who wore the crown, and when?',
    many: (months: number, artists: number) => `${months} months, ${artists} crowns`,
    one: 'One year, one crown',
    oneLine: (name: string) => `${name} never let it go.`,
    none: 'One throne, many contenders',
  },
})

/** One month's tile: its number one's photo and name, or an empty frame without one. */
function Tile({ name, month, palette, delay }: { name: string | null; month: string; palette: Palette; delay: number }) {
  const photo = useArtistImage(name ?? undefined, 240)
  return (
    <div className="wrapped-sb-flip relative min-h-0 overflow-hidden rounded-lg" style={{ animationDelay: `${delay}ms` }}>
      {name ? (
        <>
          <Picture src={photo} className="absolute inset-0 size-full rounded-lg shadow-none" />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
          <span className="absolute top-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-black uppercase" style={{ background: palette.accent, color: onAccent(palette) }}>
            {month}
          </span>
          <span className="absolute inset-x-1.5 bottom-1 line-clamp-2 text-xs leading-tight font-extrabold break-words text-white">{name}</span>
        </>
      ) : (
        <div className="flex size-full items-center justify-center rounded-lg border-2 border-dashed border-current opacity-40">
          <span className="text-[10px] font-black uppercase">{month}</span>
        </div>
      )}
    </div>
  )
}

/**
 * The year's twelve months as a 3 × 4 wall of tiles turning over one after another, each with that month's number one
 * artist; the headline counts how often the crown changed hands.
 */
export default {
  id: 'months-crowns',
  topic: 'months',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { shortMonth } = useFormats()
    const crowns = monthlyCrowns(data)
    const crowned = crowns.filter((crown) => crown !== null)
    const names = [...new Set(crowned.map((crown) => crown.name))]
    const title = names.length === 0 ? t.none : names.length === 1 ? t.one : t.many(crowned.length, names.length)
    return (
      <Body className="gap-4">
        <In>
          <p className="flex items-center gap-2 text-lg font-bold">
            <IconCrown className="size-5 shrink-0" style={{ color: accentText(palette) }} aria-hidden />
            {t.lead}
          </p>
          <Headline look={look} className="mt-1 text-4xl break-words" delay={150}>
            {title}
          </Headline>
          {names.length === 1 && <p className="mt-2 line-clamp-2 text-base font-semibold break-words">{t.oneLine(names[0]!)}</p>}
        </In>
        <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-2">
          {crowns.map((crown, month) => (
            <Tile key={month} name={crown?.name ?? null} month={shortMonth.format(new Date(Date.UTC(data.year, month, 1))).replace('.', '')} palette={palette} delay={500 + month * 110} />
          ))}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
