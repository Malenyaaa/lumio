import { IconLoader2, IconPlayerPauseFilled, IconPlaylistAdd, IconReload, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Link } from '@/components/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlaylistActions } from '@/features/listen/playlists'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Backdrop } from './backdrop'
import { deckFor, lookFor, LOOKS, TOPICS, topicAvailable } from './deck'
import { contrast, Grain, paletteStyle, PausedContext, type WrappedSlide } from './slide-kit'
import { SLIDES } from './slides'
import { useWrapped, useWrappedYears, WRAPPED_RELEASE, type Wrapped } from './wrapped-data'
import { YearTile } from './year-tile'

const messages = defineMessages({
  de: {
    title: 'Wrapped',
    indexHint: 'Aus deinem Hörverlauf in Lumio und dem, was du von Spotify importiert hast.',
    comesOut: (date: string) => `Dein Wrapped für dieses Jahr kommt am ${date}.`,
    empty: 'Noch kein Wrapped da. Hör Musik in Lumio oder bring deinen Spotify-Verlauf mit.',
    importHint: 'Spotify-Verlauf importieren',
    unavailable: 'Der Lumio-Server ist gerade nicht erreichbar.',
    nothing: (year: number) => `Für ${year} gibt es noch kein Wrapped.`,
    close: 'Schließen',
    paused: 'Angehalten',
    replay: 'Nochmal',
    makePlaylist: 'Als Playlist',
    playlistName: (year: number) => `Deine Top-Songs ${year}`,
    playlistMade: 'Playlist gespeichert',
    playlistOpen: 'Öffnen',
    playlistFailed: 'Die Playlist konnte nicht gespeichert werden.',
  },
  en: {
    title: 'Wrapped',
    indexHint: 'From your listening history in Lumio and what you imported from Spotify.',
    comesOut: (date: string) => `This year's Wrapped comes out on ${date}.`,
    empty: 'No Wrapped yet. Listen to music in Lumio or bring over your Spotify history.',
    importHint: 'Import your Spotify history',
    unavailable: 'The Lumio server can’t be reached right now.',
    nothing: (year: number) => `There’s no Wrapped for ${year} yet.`,
    close: 'Close',
    paused: 'Paused',
    replay: 'Again',
    makePlaylist: 'As playlist',
    playlistName: (year: number) => `Your top songs ${year}`,
    playlistMade: 'Playlist saved',
    playlistOpen: 'Open',
    playlistFailed: 'The playlist couldn’t be saved.',
  },
})

/** How long a slide stays before the next. */
const SLIDE_MS = 8000
/** Held this long, a slide pauses (a shorter press is a tap). */
const HOLD_MS = 700

/** Wrapped: the years to pick from (/listen/wrapped), and over it one year's story (/listen/wrapped/:year). */
export function WrappedPage() {
  const { year } = useParams()
  const number = Number(year)
  return (
    <>
      <WrappedIndex />
      {year && Number.isInteger(number) && <WrappedStory key={number} year={number} />}
    </>
  )
}

function WrappedIndex() {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const years = useWrappedYears()
  const now = new Date()
  const release = new Date(now.getFullYear(), WRAPPED_RELEASE.month, WRAPPED_RELEASE.day)
  return (
    <div className="space-y-6 px-4 pt-20 pb-12 sm:px-8">
      <div className="space-y-1">
        <h1 className="text-4xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground">{t.indexHint}</p>
      </div>
      {now < release && <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm">{t.comesOut(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(release))}</p>}
      {years.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      ) : years.isError ? (
        <p className="text-sm text-muted-foreground">{t.unavailable}</p>
      ) : !years.data?.length ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
          <Button variant="outline" nativeButton={false} render={<Link to="/listen/settings/music" />}>
            {t.importHint}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {years.data.map((year) => (
            <YearTile key={year} year={year} label={t.title} />
          ))}
        </div>
      )}
    </div>
  )
}

function WrappedStory({ year }: { year: number }) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const wrapped = useWrapped(year)
  const { state } = useLocation()
  // Closing goes up to the list, never forward into history: opened from the list, it is the step back; opened
  // directly (the start page's banner, a link), the story's entry becomes the list. Back then leaves Wrapped.
  const close = () =>
    (state as { fromList?: boolean } | null)?.fromList
      ? void navigate(-1)
      : void navigate('/listen/wrapped', { replace: true, state: { keepScroll: true }, preventScrollReset: true })
  if (wrapped.isLoading || !wrapped.data) {
    return (
      <StoryFrame onClose={close} closeLabel={t.close} style={paletteStyle(LOOKS[0]!.palettes[0]!)}>
        <div className="grid h-full place-items-center p-8 text-center">
          {wrapped.isLoading ? <IconLoader2 className="size-8 animate-spin" /> : <p className="text-lg font-bold">{wrapped.isError ? t.unavailable : t.nothing(year)}</p>}
        </div>
      </StoryFrame>
    )
  }
  return <Story data={wrapped.data} onClose={close} />
}

/** Over everything (the tabs and the mini player too), on the page's body; on wide screens a phone-shaped card. */
function StoryFrame({ onClose, closeLabel, style, top, children }: { onClose: () => void; closeLabel: string; style: CSSProperties; top?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/90 animate-in fade-in-0 duration-300">
      <div className="relative h-dvh w-full overflow-hidden transition-[background,color] duration-700 select-none sm:h-[min(92dvh,52rem)] sm:w-auto sm:aspect-[9/16] sm:rounded-2xl sm:shadow-2xl" style={style}>
        {children}
        <div className="absolute inset-x-0 top-0 z-30 space-y-3 px-3 pt-[max(0.75rem,var(--safe-top))]">
          {top}
          <div className="flex justify-end">
            <button type="button" aria-label={closeLabel} onClick={onClose} className="grid size-10 place-items-center rounded-full bg-black/25 text-white outline-none backdrop-blur-sm">
              <IconX className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The year's slides: one per topic the year draws (deck.ts), leaving out those the data has nothing for. `?slide=<id>`
 * shows just that slide with the year's data (for working on the slides).
 */
function useStorySlides(data: Wrapped): WrappedSlide[] {
  const only = useSearchParams()[0].get('slide')
  return useMemo(() => {
    const single = only ? SLIDES.find((slide) => slide.id === only) : undefined
    if (single) return [single]
    const deck = deckFor(data.year, SLIDES)
    return TOPICS.filter((topic) => deck.has(topic) && topicAvailable(topic, data))
      .map((topic) => SLIDES.find((slide) => slide.id === deck.get(topic)))
      .filter((slide): slide is WrappedSlide => !!slide)
  }, [data, only])
}

function Story({ data, onClose }: { data: Wrapped; onClose: () => void }) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const { create } = usePlaylistActions()
  const slides = useStorySlides(data)
  const look = lookFor(data.year)
  const [index, setIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const running = useRef(0)
  const [held, setHeld] = useState(false)
  const pressedAt = useRef(0)
  const holdTimer = useRef(0)
  const last = index === slides.length - 1
  const palette = look.palettes[index % look.palettes.length]!
  const slide = slides[index]!
  const Slide = slide.Component

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(slides.length - 1, next)))
    running.current = 0
    setElapsed(0)
  }

  // The slide's time runs while it is shown, not held and the page is visible; the last one stays.
  useEffect(() => {
    if (held || last) return
    let previous = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      if (!document.hidden) running.current += now - previous
      previous = now
      if (running.current >= SLIDE_MS) {
        running.current = 0
        setIndex((value) => Math.min(slides.length - 1, value + 1))
        setElapsed(0)
        return
      }
      setElapsed(running.current)
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [held, last, index, slides.length])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(index + 1)
      else if (event.key === 'ArrowLeft') go(index - 1)
      else if (event.key === ' ') {
        event.preventDefault()
        setHeld((value) => !value)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const bars = (
    <div className="relative">
      <div className="flex gap-1" style={{ color: palette.color }}>
        {slides.map((slide, position) => (
          <div key={slide.id} className="h-1 flex-1 overflow-hidden rounded-full bg-current/25">
            <div className="h-full rounded-full bg-current" style={{ width: position < index ? '100%' : position > index ? '0%' : last ? '100%' : `${Math.min(100, (elapsed / SLIDE_MS) * 100)}%` }} />
          </div>
        ))}
      </div>
      {/* Paused: said right under the bars. */}
      {held && !last && (
        <span className="absolute top-3 left-0 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
          <IconPlayerPauseFilled className="size-3" />
          {t.paused}
        </span>
      )}
    </div>
  )

  return (
    <StoryFrame onClose={onClose} closeLabel={t.close} style={paletteStyle(palette)} top={bars}>
      {look.grain && <Grain />}
      <div
        className={cn('absolute inset-0 touch-manipulation', held && 'wrapped-paused')}
        // A tap on the left third goes back, elsewhere on; held a moment, the slide pauses (as in stories). Tapping
        // through never flashes the pause.
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button, a')) return
          pressedAt.current = Date.now()
          window.clearTimeout(holdTimer.current)
          holdTimer.current = window.setTimeout(() => setHeld(true), HOLD_MS)
        }}
        onPointerUp={(event) => {
          window.clearTimeout(holdTimer.current)
          setHeld(false)
          if (!pressedAt.current || (event.target as HTMLElement).closest('button, a')) return
          const long = Date.now() - pressedAt.current >= HOLD_MS
          pressedAt.current = 0
          if (long) return
          const rect = event.currentTarget.getBoundingClientRect()
          go(event.clientX - rect.left < rect.width / 3 ? index - 1 : index + 1)
        }}
        onPointerCancel={() => {
          window.clearTimeout(holdTimer.current)
          pressedAt.current = 0
          setHeld(false)
        }}
      >
        <div
          key={slide.id}
          className="absolute inset-0 overflow-hidden animate-in fade-in-0 duration-300 [animation-delay:250ms] fill-mode-both [&_p]:[text-shadow:var(--wrapped-shadow)]"
          // A soft shadow against the text color, so it reads over the moving backdrop.
          style={{ '--wrapped-shadow': contrast(palette.color, '#000000') > 10 ? '0 1px 14px rgb(0 0 0 / 0.45)' : '0 1px 12px rgb(255 255 255 / 0.4)' } as CSSProperties}
        >
          {slide.backdrop !== false && <Backdrop id={slide.id} year={data.year} look={look} palette={palette} />}
          <PausedContext.Provider value={held}>
            <Slide data={data} look={look} palette={palette} active />
          </PausedContext.Provider>
        </div>
        {/* The next slide's color sweeps across as it comes (not for the first). */}
        {index > 0 && <div key={`wipe-${slide.id}`} aria-hidden className="wrapped-wipe pointer-events-none absolute inset-y-0 -inset-x-8 z-10" style={{ background: palette.accent }} />}
      </div>
      {last && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 px-6 pb-[max(1.25rem,var(--safe-bottom))]">
          <Button className="bg-black/80 text-white hover:bg-black/70" onClick={() => go(0)}>
            <IconReload />
            {t.replay}
          </Button>
          {data.playlistKeys.length > 0 && (
            <Button
              className="bg-white text-black hover:bg-white/90"
              disabled={create.isPending}
              onClick={() =>
                create.mutate(
                  { name: t.playlistName(data.year), ids: data.playlistKeys },
                  {
                    onSuccess: (id) => toast.success(t.playlistMade, { action: { label: t.playlistOpen, onClick: () => void navigate(`/listen/playlist/${id}`) } }),
                    onError: () => toast.error(t.playlistFailed),
                  },
                )
              }
            >
              {create.isPending ? <IconLoader2 className="animate-spin" /> : <IconPlaylistAdd />}
              {t.makePlaylist}
            </Button>
          )}
        </div>
      )}
    </StoryFrame>
  )
}
