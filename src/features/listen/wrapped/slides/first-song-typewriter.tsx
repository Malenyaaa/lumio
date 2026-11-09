import { defineMessages, useMessages } from '@/lib/i18n'
import { Body, In, Picture, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: { lead: (date: string) => `${date}. Das Jahr beginnt mit:` },
  en: { lead: (date: string) => `${date}. The year starts with:` },
})

/** The first song of the year typed out letter by letter, with a blinking caret, on a terminal-like card. */
export default {
  id: 'first-song-typewriter',
  topic: 'first-song',
  Component: ({ data, palette }) => {
    const t = useMessages(messages)
    const track = data.firstTrack!
    const cover = useTrackCover(track, 320)
    const date = new Intl.DateTimeFormat(useFormats().locale, { day: 'numeric', month: 'long' }).format(track.at)
    const text = `${track.title}${track.artist ? ` – ${track.artist}` : ''}`
    return (
      <Body className="justify-center gap-6">
        <In from="fade" className="-rotate-2 rounded-xl bg-black/80 p-5 font-mono text-[#e5ffe9] shadow-2xl">
          <p className="text-sm opacity-70">$ wrapped --first {data.year}</p>
          <p className="mt-3 text-sm" style={{ color: palette.accent }}>
            {t.lead(date)}
          </p>
          <p className="mt-2 text-2xl leading-snug font-bold">
            {[...text].map((char, index) => (
              <span key={index} className="animate-in fade-in-0 fill-mode-both duration-75" style={{ animationDelay: `${600 + index * 55}ms` }}>
                {char}
              </span>
            ))}
            <span className="ml-0.5 inline-block w-3 animate-pulse bg-current">&nbsp;</span>
          </p>
        </In>
        <In delay={700 + text.length * 55} from="zoom" className="self-end">
          <Picture src={cover} className="size-36 rotate-3" />
        </In>
      </Body>
    )
  },
} satisfies WrappedSlide
