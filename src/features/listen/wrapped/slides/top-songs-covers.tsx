import { defineMessages, useMessages } from '@/lib/i18n'
import type { WrappedTrack } from '../wrapped-data'
import { Body, Headline, In, Picture, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Deine Top-Songs' },
  en: { title: 'Your top songs' },
})

function Row({ track, rank, delay }: { track: WrappedTrack; rank: number; delay: number }) {
  const cover = useTrackCover(track, 200)
  return (
    <In delay={delay} className="flex items-center gap-4">
      <span className="w-6 shrink-0 text-3xl font-black tabular-nums">{rank}</span>
      <Picture src={cover} className="size-[4.25rem] shrink-0" />
      <span className="min-w-0">
        <span className="line-clamp-2 text-lg leading-tight font-extrabold">{track.title}</span>
        {track.artist && <span className="block truncate text-sm opacity-80">{track.artist}</span>}
      </span>
    </In>
  )
}

/** A rank, a large cover, two lines of title and the artist (2022). */
export default {
  id: 'top-songs-covers',
  topic: 'top-songs',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    return (
      <Body className="justify-center gap-5">
        <In>
          <Headline look={look} className="text-3xl">
            {t.title}
          </Headline>
        </In>
        <div className="space-y-3.5">
          {data.topTracks.slice(0, 5).map((track, index) => (
            <Row key={track.key} track={track} rank={index + 1} delay={200 + index * 150} />
          ))}
        </div>
      </Body>
    )
  },
} satisfies WrappedSlide
