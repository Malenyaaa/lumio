import { useItem } from '@/features/items/queries'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../specials-a.css'
import { accentText, Body, Headline, In, inHours, Picture, useAlbum, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'
import { inLibrary, type Wrapped } from '../wrapped-data'

const messages = defineMessages({
  de: {
    lead: 'Dieses Album lief bei dir in Endlosschleife',
    through: 'mal komplett durchgehört',
    hours: 'Stunden lang lief nur das',
    share: (percent: number) => `${percent} % deiner ganzen Musikzeit`,
    tracks: (count: string) => `${count} seiner Songs`,
  },
  en: {
    lead: 'This album was on endless loop for you',
    through: 'times, start to finish',
    hours: 'hours of nothing but this',
    share: (percent: number) => `${percent}% of all your listening`,
    tracks: (count: string) => `${count} of its songs`,
  },
})

/** A year with one album played far more than usual: its top album at least five hours and 8 % of all minutes. */
function strength(data: Wrapped) {
  const top = data.topAlbums[0]
  if (!top || data.minutes <= 0 || top.minutes < 300) return 0
  const share = top.minutes / data.minutes
  return share >= 0.08 ? Math.min(3, share / 0.08) : 0
}

/**
 * The album played to death: its cover dealt onto a stack of the same sleeves, how often it went round in full (from
 * the library's album length; hours for an album the library doesn't have). For a year with one album far ahead.
 */
export default {
  id: 'special-album-marathon',
  topic: 'special',
  special: strength,
  after: 'album',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topAlbums[0]!
    const album = useAlbum(top, 720)
    const item = useItem(top.key, inLibrary(top.key))
    const length = (item.data?.RunTimeTicks ?? 0) / 600_000_000
    // Times through only for a real album (not a single of a few minutes), and when it went round more than once.
    const times = length >= 15 ? Math.round(top.minutes / length) : 0
    const big = times >= 2 ? times : inHours(top.minutes).hours
    const shown = useCountUp(big, active, 1600, 900)
    const sleeves = Math.min(5, Math.max(3, Math.round(strength(data) * 2)))
    return (
      <Body className="justify-center gap-4">
        <In>
          <p className="text-xl font-bold">{t.lead}</p>
        </In>
        <div className="relative mx-auto h-48 w-56 shrink-0" aria-hidden>
          {Array.from({ length: sleeves }, (_, index) => {
            const back = sleeves - 1 - index
            return (
              <div key={index} className="absolute inset-x-4 inset-y-0" style={{ transform: `translate(${back * 9 - 10}px, ${back * -7}px) rotate(${back * 5 - 4}deg)` }}>
                <div className="wrapped-sa-deal size-full" style={{ animationDelay: `${200 + index * 160}ms` }}>
                  <Picture src={album.cover} className="size-full" style={{ filter: back ? `brightness(${1 - back * 0.14})` : undefined }} />
                </div>
              </div>
            )
          })}
        </div>
        <In delay={700}>
          <Headline look={look} className="line-clamp-2 text-3xl break-words">
            {album.name}
          </Headline>
          {album.artist && <p className="mt-1 truncate text-lg font-bold">{album.artist}</p>}
        </In>
        <In delay={900} className="flex items-baseline gap-3">
          <span className="text-5xl font-black tabular-nums" style={{ color: accentText(palette) }}>
            {times >= 2 ? `≈ ${number.format(shown)}×` : number.format(shown)}
          </span>
          <span className="text-lg leading-tight font-bold">{times >= 2 ? t.through : t.hours}</span>
        </In>
        <In delay={1300}>
          <p className="font-semibold">
            {t.share(Math.round((top.minutes / Math.max(1, data.minutes)) * 100))}
            {top.tracks > 0 && ` · ${t.tracks(number.format(top.tracks))}`}
          </p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
