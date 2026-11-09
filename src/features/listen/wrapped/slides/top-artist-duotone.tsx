import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useArtistImage, useFormats, type WrappedSlide } from '../slide-kit'
import { FadeImage } from '@/components/media/fade-image'

const messages = defineMessages({
  de: { lead: 'Dein*e Künstler*in des Jahres', minutes: (value: string) => `${value} Minuten zusammen.` },
  en: { lead: 'Your artist of the year', minutes: (value: string) => `${value} minutes together.` },
})

/** A duotone photo with stepped pixel corners in a hot gradient (2024). */
export default {
  id: 'top-artist-duotone',
  topic: 'top-artist',
  Component: ({ data, look, palette }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topArtists[0]!
    const photo = useArtistImage(top.name, 720)
    const steps = [0, 1, 2, 3, 4, 5]
    return (
      <>
        {/* Pixel staircases in two corners. */}
        {(['top-0 left-0', 'right-0 bottom-0 rotate-180'] as const).map((corner) => (
          <div key={corner} aria-hidden className={`absolute ${corner} flex flex-col`}>
            {steps.map((step) => (
              <div
                key={step}
                className="wrapped-grow-x h-6"
                style={{ width: `${(6 - step) * 22}px`, background: `color-mix(in srgb, ${palette.accent} ${100 - step * 14}%, #e81b00)`, animationDelay: `${step * 70}ms` }}
              />
            ))}
          </div>
        ))}
        <Body className="justify-center gap-6">
          <In>
            <p className="text-xl font-bold">{t.lead}</p>
          </In>
          <In delay={200} from="zoom" className="relative aspect-square w-full overflow-hidden rounded-md" style={{ background: palette.accent }}>
            {photo && <FadeImage src={photo} alt="" className="size-full object-cover grayscale mix-blend-multiply contrast-125" draggable={false} />}
          </In>
          <In delay={500}>
            <Headline look={look} className="text-5xl break-words">
              {top.name}
            </Headline>
            <p className="mt-2 text-lg font-semibold">{t.minutes(number.format(top.minutes))}</p>
          </In>
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
