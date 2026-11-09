import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Picture, displayClass, useArtistImage, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Deine Top-Künstler*innen' },
  en: { title: 'Your top artists' },
})

function Row({ name, rank, look, delay }: { name: string; rank: number; look: Parameters<typeof displayClass>[0]; delay: number }) {
  const photo = useArtistImage(name, 160)
  return (
    <In delay={delay} from="left" className="grid grid-cols-[3rem_4.5rem_1fr] items-center gap-3">
      <span className={`text-6xl leading-none ${displayClass(look)}`}>{rank}</span>
      <Picture src={photo} className="size-[4.5rem] rounded-sm" />
      <span className="truncate text-xl font-extrabold">{name}</span>
    </In>
  )
}

/** Huge rank numerals, small square photos, names (2024). */
export default {
  id: 'top-artists-numerals',
  topic: 'top-artists',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    return (
      <Body className="justify-center gap-6">
        <In>
          <Headline look={look} className="text-3xl">
            {t.title}
          </Headline>
        </In>
        <div className="space-y-4">
          {data.topArtists.slice(0, 5).map((artist, index) => (
            <Row key={artist.name} name={artist.name} rank={index + 1} look={look} delay={200 + index * 140} />
          ))}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
