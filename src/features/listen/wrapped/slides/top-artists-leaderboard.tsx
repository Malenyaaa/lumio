import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, Picture, displayClass, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Rangliste', minutes: (value: string) => `${value} Minuten` },
  en: { title: 'Leaderboard', minutes: (value: string) => `${value} minutes` },
})

function Avatar({ name, size }: { name: string; size: string }) {
  return <Picture src={useArtistImage(name, 240)} round className={size} />
}

/** An off-white card: the winner with a crown, their name huge with a label, the rest as ranked rows (2025's party). */
export default {
  id: 'top-artists-leaderboard',
  topic: 'top-artists',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const [first, ...rest] = data.topArtists.slice(0, 5)
    return (
      <>
        <div aria-hidden className="wrapped-stripes wrapped-stripes-move absolute inset-0 opacity-15" />
        <Body className="justify-center">
          <In from="zoom" className="border-2 border-black bg-[#eeefe9] p-5 text-[#111] shadow-[6px_6px_0_#000]">
            <p className="text-xs font-bold tracking-[0.25em] uppercase">{t.title}</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative shrink-0">
                <span aria-hidden className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">♛</span>
                <Avatar name={first!.name} size="size-20" />
              </div>
              <div className="min-w-0">
                <p className={`truncate text-4xl ${displayClass(look)}`} style={{ color: palette.accent }}>
                  {first!.name}
                </p>
                <span className="mt-1 inline-block bg-black px-2 py-0.5 text-xs font-bold text-white">{t.minutes(number.format(first!.minutes))}</span>
              </div>
            </div>
            <div className="mt-4 divide-y divide-black/20 border-t border-black/20">
              {rest.map((artist, index) => (
                <In key={artist.name} delay={400 + index * 120} from="fade" className="flex items-center gap-3 py-2">
                  <span className="w-7 text-xs font-bold">#{index + 2}</span>
                  <Avatar name={artist.name} size="size-9" />
                  <span className="min-w-0 flex-1 truncate font-bold">{artist.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{number.format(artist.minutes)}</span>
                </In>
              ))}
            </div>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
