import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, useAlbum, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Dein Album des Jahres', minutes: (value: string) => `${value} Minuten von vorn bis hinten` },
  en: { lead: 'Your album of the year', minutes: (value: string) => `${value} minutes, front to back` },
})

/** The cover tilting in 3D with a glossy sheen sweeping across it. */
export default {
  id: 'album-sleeve',
  topic: 'album',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const album = useAlbum(data.topAlbums[0], 720)
    return (
      <Body className="justify-center gap-7 [perspective:900px]">
        <In>
          <p className="text-2xl font-bold">{t.lead}</p>
        </In>
        <div className="relative size-64 self-center animate-in fade-in-0 duration-1000 fill-mode-both [transform:rotateY(-18deg)_rotateX(8deg)] [animation-delay:200ms]">
          <div className="size-full overflow-hidden rounded-sm bg-black/30 shadow-[20px_30px_60px_rgb(0_0_0/0.5)]">
            {album.cover && <FadeImage src={album.cover} alt="" className="size-full object-cover" />}
          </div>
          <div aria-hidden className="absolute inset-0 animate-[wrapped-sheen_3s_ease-in-out_1s_infinite] bg-[linear-gradient(115deg,transparent_35%,rgb(255_255_255/0.45)_50%,transparent_65%)] bg-[length:250%_100%]" />
        </div>
        <In delay={500}>
          <Headline look={look} className="text-4xl break-words">
            {album.name}
          </Headline>
          {album.artist && <p className="mt-1 text-xl font-bold opacity-85">{album.artist}</p>}
          <p className="mt-3 text-base font-semibold opacity-80">{t.minutes(number.format(data.topAlbums[0]!.minutes))}</p>
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
