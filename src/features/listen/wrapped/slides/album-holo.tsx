import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, Headline, In, Picture, useAlbum, useFormats, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: 'Ein Album, das du nicht weglegen konntest', others: 'Gleich dahinter' },
  en: { lead: 'An album you couldn’t put down', others: 'Right behind it' },
})

function Small({ album }: { album: Parameters<typeof useAlbum>[0] }) {
  const info = useAlbum(album, 160)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Picture src={info.cover} className="size-10 shrink-0 rounded-sm" />
      <span className="truncate text-sm font-bold">{info.name}</span>
    </div>
  )
}

/** A holographic block in the corner, the cover over it, the runners-up below (2023). */
export default {
  id: 'album-holo',
  topic: 'album',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const album = useAlbum(data.topAlbums[0], 720)
    return (
      <>
        <div aria-hidden className="wrapped-blob absolute -top-10 -right-20 h-72 w-80 rounded-3xl" style={{ background: 'linear-gradient(135deg, #22e1ff, #ff3bd4, #f5ff00)', filter: 'blur(4px)' }} />
        <Body className="justify-center gap-6">
          <In>
            <p className="text-xl font-bold">{t.lead}</p>
          </In>
          <In delay={200} from="zoom">
            <Picture src={album.cover} className="size-60 -rotate-3" />
          </In>
          <In delay={450}>
            <Headline look={look} className="text-4xl break-words">
              {album.name}
            </Headline>
            <p className="mt-1 font-bold">
              {album.artist} · {number.format(data.topAlbums[0]!.minutes)} min
            </p>
          </In>
          {data.topAlbums.length > 1 && (
            <In delay={900} className="space-y-2">
              <p className="text-xs font-bold tracking-wide uppercase">{t.others}</p>
              {data.topAlbums.slice(1, 3).map((other) => (
                <Small key={other.key} album={other} />
              ))}
            </In>
          )}
        </Body>
      </>
    )
  },
} satisfies WrappedSlide
