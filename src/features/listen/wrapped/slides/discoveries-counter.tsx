import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Picture, useArtistImage, useCountUp, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Du hast dieses Jahr', unit: (count: number) => (count === 1 ? 'neue*n Künstler*in entdeckt.' : 'neue Künstler*innen entdeckt.'), top: (name: string) => `Deine größte Entdeckung: ${name}.` },
  en: { lead: 'This year you discovered', unit: (count: number) => (count === 1 ? 'new artist.' : 'new artists.'), top: (name: string) => `Your biggest find: ${name}.` },
})

/** The number of new artists counting up, the biggest find below. */
export default {
  id: 'discoveries-counter',
  topic: 'discoveries',
  Component: ({ data, look, active }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const count = useCountUp(data.newArtists.count, active, 1100, 200)
    const top = data.newArtists.top
    const photo = useArtistImage(top?.name, 320)
    return (
      <Body className="justify-center gap-4">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <Headline look={look} className="text-8xl tabular-nums">
          {number.format(count)}
        </Headline>
        <In delay={200}>
          <p className="text-2xl font-bold">{t.unit(data.newArtists.count)}</p>
        </In>
        {top && (
          <In delay={1300} from="left" className="mt-6 flex items-center gap-4">
            <Picture src={photo} round className="size-20 shrink-0" />
            <p className="text-xl font-extrabold">{t.top(top.name)}</p>
          </In>
        )}
      </Body>
    )
  },
} satisfies WrappedSlide
