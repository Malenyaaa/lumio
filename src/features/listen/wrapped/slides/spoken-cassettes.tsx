import { IconHeadphones } from '@tabler/icons-react'
import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../spoken.css'
import { accentText, Body, Headline, In, inHours, onAccent, useCountUp, useFormats, useTrackCover, type Palette, type WrappedSlide } from '../slide-kit'
import type { Wrapped } from '../wrapped-data'

const messages = defineMessages({
  de: {
    lead: 'Hörspiele & Hörbücher',
    stories: (one: boolean) => (one ? 'Stunde Geschichten' : 'Stunden Geschichten'),
    episodes: (count: string, one: boolean) => `${count} ${one ? 'Folge' : 'Folgen'}`,
    minutes: (value: string) => `${value} Min.`,
    favorite: 'Am häufigsten gehört',
  },
  en: {
    lead: 'Audio dramas & audiobooks',
    stories: (one: boolean) => (one ? 'hour of stories' : 'hours of stories'),
    episodes: (count: string, one: boolean) => `${count} ${one ? 'episode' : 'episodes'}`,
    minutes: (value: string) => `${value} min`,
    favorite: 'Heard most',
  },
})

type Spoken = Wrapped['topSpoken'][number]

/** An episode's name as files give it ("209/Kreaturen der Nacht"), its number set apart. */
const episodeName = (episode: string) => episode.replace(/\s*\/\s*/g, ' · ')

/** One tape: the series' cover and name on the label, two reels turning in the window below. */
function Cassette({ entry, palette, delay }: { entry: Spoken; palette: Palette; delay: number }) {
  const t = useMessages(messages)
  const { number } = useFormats()
  const cover = useTrackCover({ key: entry.sampleKey, contextId: entry.contextId }, 160)
  const ink = onAccent(palette)
  return (
    <div className="wrapped-sp-slide relative rounded-lg p-1.5 shadow-xl ring-1 ring-white/10" style={{ background: '#1d1d22', animationDelay: `${delay}ms` }}>
      {[
        'top-1 left-1',
        'top-1 right-1',
        'bottom-1 left-1',
        'right-1 bottom-1',
      ].map((corner) => (
        <span key={corner} aria-hidden className={`absolute size-1 rounded-full bg-white/30 ${corner}`} />
      ))}
      <div className="flex items-center gap-2.5 rounded-md p-1.5" style={{ background: palette.accent, color: ink }}>
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-sm bg-black/25">
          {cover ? <FadeImage src={cover} alt="" className="size-full object-cover" draggable={false} /> : <IconHeadphones aria-hidden className="size-7 opacity-70" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-tight font-extrabold">{entry.name}</p>
          <p className="mt-0.5 truncate text-xs font-bold opacity-80">
            {entry.episodes > 0 && `${t.episodes(number.format(entry.episodes), entry.episodes === 1)} · `}
            {t.minutes(number.format(entry.minutes))}
          </p>
        </div>
        {/* The window with the tape's two reels. */}
        <div aria-hidden className="flex h-9 w-[4.5rem] shrink-0 items-center justify-between rounded-full bg-[#1d1d22] px-1.5">
          {[0, 1].map((reel) => (
            <span
              key={reel}
              className="wrapped-sp-reel grid size-6 place-items-center rounded-full"
              style={{ background: `repeating-conic-gradient(#f4f4f5 0 20deg, #3a3a42 20deg 60deg)`, animationDelay: `${reel * -0.7}s` }}
            >
              <span className="size-2.5 rounded-full bg-[#1d1d22]" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * A shelf of cassette tapes, one per top series (or author), sliding in one after another with their reels turning: the
 * cover and name on each label, the episodes and minutes; the hours of stories on top, the most-heard episode below.
 */
export default {
  id: 'spoken-cassettes',
  topic: 'spoken',
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const { hours } = inHours(data.spokenMinutes)
    const shown = useCountUp(hours, active, 1400, 300)
    const episode = data.topSpoken[0]?.episode
    return (
      <Body className="justify-center gap-5">
        <In>
          <p className="text-sm font-bold tracking-[0.2em] uppercase">{t.lead}</p>
          <Headline look={look} className="mt-2 text-4xl break-words">
            <span style={{ color: accentText(palette) }}>{number.format(shown)}</span> {t.stories(hours === 1)}
          </Headline>
        </In>
        <div className="space-y-3">
          {data.topSpoken.map((entry, index) => (
            <Cassette key={entry.name} entry={entry} palette={palette} delay={400 + index * 220} />
          ))}
        </div>
        {episode && (
          <In delay={400 + data.topSpoken.length * 220 + 200}>
            <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-80">{t.favorite}</p>
            <p className="mt-1 line-clamp-2 text-lg leading-snug font-extrabold break-words">{episodeName(episode)}</p>
          </In>
        )}
      </Body>
    )
  },
} satisfies WrappedSlide
