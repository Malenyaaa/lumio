import { IconBook2 } from '@tabler/icons-react'
import { FadeImage } from '@/components/media/fade-image'
import { defineMessages, useMessages } from '@/lib/i18n'
import '../spoken.css'
import { accentText, Body, Headline, In, inHours, useCountUp, useFormats, useTrackCover, type WrappedSlide } from '../slide-kit'

const messages = defineMessages({
  de: {
    lead: 'Hörspiele & Hörbücher',
    favorite: 'Deine Lieblingsgeschichte',
    episode: 'Am häufigsten gehört',
    stories: (one: boolean) => (one ? 'Stunde Geschichten' : 'Stunden Geschichten'),
    minutes: (value: string) => `${value} Min.`,
  },
  en: {
    lead: 'Audio dramas & audiobooks',
    favorite: 'Your favorite story',
    episode: 'Heard most',
    stories: (one: boolean) => (one ? 'hour of stories' : 'hours of stories'),
    minutes: (value: string) => `${value} min`,
  },
})

/** The night around the fire: dark above, glowing embers below. */
const NIGHT = 'radial-gradient(120% 70% at 50% 108%, #ffb057 0%, #e8590c 18%, #7c2d12 38%, #2a1208 62%, #0d0705 100%)'
/** The text on it, and the color behind the text (for the accent's contrast). */
const INK = '#fff6e8'
const BEHIND = '#2a1208'

/** An episode's name as files give it ("209/Kreaturen der Nacht"), its number set apart. */
const episodeName = (episode: string) => episode.replace(/\s*\/\s*/g, ' · ')

/** Where the sparks rise from (% across) and how far they stray. */
const SPARKS = [
  { left: 38, drift: -30, delay: 0 },
  { left: 47, drift: 18, delay: 0.9 },
  { left: 55, drift: -12, delay: 1.7 },
  { left: 61, drift: 34, delay: 0.4 },
  { left: 43, drift: 8, delay: 2.4 },
  { left: 52, drift: -26, delay: 1.2 },
]

/**
 * Storytelling by the campfire: the favorite series' cover as a book standing open over the glow, its most-heard
 * episode on the right-hand page, sparks rising behind; the hours of stories counting up, the other series as chips.
 */
export default {
  id: 'spoken-campfire',
  topic: 'spoken',
  backdrop: false,
  ink: INK,
  Component: ({ data, look, palette, active }) => {
    const t = useMessages(messages)
    const { number } = useFormats()
    const top = data.topSpoken[0]!
    const cover = useTrackCover({ key: top.sampleKey, contextId: top.contextId }, 480)
    const { hours } = inHours(data.spokenMinutes)
    const shown = useCountUp(hours, active, 1600, 900)
    const accent = accentText(palette, BEHIND)
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ background: NIGHT, color: INK }}>
        <div aria-hidden className="wrapped-sp-flicker absolute inset-x-[-20%] bottom-[-18%] h-[55%] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, #ffcf73cc, #ff7a1a66, transparent)' }} />
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            aria-hidden
            className="wrapped-sp-spark absolute bottom-[8%] size-1.5 rounded-full"
            style={{ left: `${spark.left}%`, background: '#ffd27a', boxShadow: '0 0 8px #ffb347', animationDelay: `${spark.delay}s`, ['--drift' as string]: `${spark.drift}px` }}
          />
        ))}
        <Body className="justify-center gap-5">
          <In>
            <p className="text-sm font-bold tracking-[0.2em] uppercase opacity-85">{t.lead}</p>
            <p className="mt-1 text-xl font-bold">{t.favorite}</p>
          </In>
          {/* The book: the cover on the left, the page with the episode on the right. */}
          <div aria-hidden className="wrapped-sp-open mx-auto flex h-44 w-full max-w-72 shrink-0 drop-shadow-[0_18px_30px_rgba(255,140,40,0.45)]" style={{ animationDelay: '250ms' }}>
            <div className="relative h-full flex-1 overflow-hidden rounded-l-md" style={{ background: palette.accent, transform: 'perspective(500px) rotateY(12deg)', transformOrigin: 'right center' }}>
              {cover ? (
                <FadeImage src={cover} alt="" className="size-full object-cover" draggable={false} />
              ) : (
                <div className="grid size-full place-items-center bg-black/25">
                  <IconBook2 className="size-12 text-white/80" />
                </div>
              )}
              <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/40 to-transparent" />
            </div>
            <div
              className="relative h-full flex-1 overflow-hidden rounded-r-md px-3 py-2.5 text-[#3b2410]"
              style={{ background: 'linear-gradient(90deg, #d9c4a0, #f6ecd9 18%, #fbf4e6)', transform: 'perspective(500px) rotateY(-12deg)', transformOrigin: 'left center' }}
            >
              <p className="text-[0.6rem] font-bold tracking-[0.18em] uppercase opacity-70">{t.episode}</p>
              <p className="mt-1 line-clamp-4 font-serif text-sm leading-snug font-bold italic break-words">{top.episode ? episodeName(top.episode) : top.name}</p>
              <div className="absolute inset-x-3 bottom-3 space-y-1.5 opacity-25">
                {[100, 92, 96, 70].map((width) => (
                  <div key={width} className="h-0.5 rounded-full bg-current" style={{ width: `${width}%` }} />
                ))}
              </div>
            </div>
          </div>
          <In delay={700}>
            <Headline look={look} className="line-clamp-2 text-4xl break-words">
              {top.name}
            </Headline>
            {top.episode && <p className="sr-only">{episodeName(top.episode)}</p>}
          </In>
          <In delay={900} className="flex items-baseline gap-3">
            <span className="text-5xl font-black tabular-nums" style={{ color: accent }}>
              {number.format(shown)}
            </span>
            <span className="text-lg leading-tight font-bold">{t.stories(hours === 1)}</span>
          </In>
          {data.topSpoken.length > 1 && (
            <In delay={1200} className="flex flex-wrap gap-2">
              {data.topSpoken.slice(1).map((entry) => (
                <span key={entry.name} className="flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-sm font-bold ring-1 ring-white/15 backdrop-blur-sm">
                  <span className="truncate">{entry.name}</span>
                  <span className="shrink-0 opacity-75">{t.minutes(number.format(entry.minutes))}</span>
                </span>
              ))}
            </In>
          )}
        </Body>
      </div>
    )
  },
} satisfies WrappedSlide
