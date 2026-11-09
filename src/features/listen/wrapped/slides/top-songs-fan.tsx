import { defineMessages, useMessages } from '@/lib/i18n'
import type { WrappedTrack } from '../wrapped-data'
import { Body, Headline, In, Picture, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { title: 'Fünf Songs, die du nicht loslassen konntest' },
  en: { title: 'Five songs you couldn’t let go of' },
})

function Card({ track, index }: { track: WrappedTrack; index: number }) {
  const cover = useTrackCover(track, 320)
  const angle = (index - 2) * 9
  return (
    <div
      className="absolute bottom-10 left-1/2 w-36 origin-bottom animate-in fade-in-0 slide-in-from-bottom-24 duration-700 fill-mode-both"
      style={{ transform: `translateX(-50%) rotate(${angle}deg) translateY(${Math.abs(index - 2) * 10}px)`, animationDelay: `${200 + index * 130}ms`, zIndex: 5 - Math.abs(index - 2) }}
    >
      <Picture src={cover} className="aspect-square w-full border-4 border-white" />
    </div>
  )
}

/** The covers fanned out like a hand of cards, the list below. */
export default {
  id: 'top-songs-fan',
  topic: 'top-songs',
  Component: ({ data, look }) => {
    const t = useMessages(messages)
    const tracks = data.topTracks.slice(0, 5)
    return (
      <Body className="gap-6">
        <In>
          <Headline look={look} className="text-3xl">
            {t.title}
          </Headline>
        </In>
        {/* Room below the cards: turned, their corners reach lower than they stand. */}
        <div className="relative h-60 shrink-0">
          {tracks.map((track, index) => (
            <Card key={track.key} track={track} index={index} />
          ))}
        </div>
        <ol className="space-y-1.5">
          {tracks.map((track, index) => (
            <li key={track.key} className="truncate text-lg animate-in fade-in-0 duration-700 fill-mode-both" style={{ animationDelay: `${900 + index * 100}ms` }}>
              <span className="font-black">{index + 1}</span> <span className="font-extrabold">{track.title}</span>
              {track.artist && <span className="opacity-75"> · {track.artist}</span>}
            </li>
          ))}
        </ol>
      </Body>
    )
  },
} satisfies WrappedSlide
