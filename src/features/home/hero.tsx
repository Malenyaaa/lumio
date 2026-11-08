import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconInfoCircle, IconPlayerPlay } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthedSession } from '@/features/auth/session'
import { formatRuntime, plainText } from '@/lib/format'
import { useMessages } from '@/lib/i18n'
import { backdropImageUrl, logoImageUrl } from '@/lib/images'
import { itemHref, playHref } from '@/lib/item-links'
import { cn } from '@/lib/utils'
import { homeMessages } from './messages'
import { useLocalizedItem } from '@/lib/localized'

interface HeroProps {
  /** The titles to feature (the first few are shown in turn). */
  items: BaseItemDto[]
  loading?: boolean
}

const MAX_SLIDES = 5
/** How long each title stays before the next one comes in. */
const SLIDE_MS = 8000
/** If the next slide's images still aren't ready when its turn comes, wait at most this much longer. */
const MAX_WAIT_MS = 3000

/** The big images of a slide; the same URLs the slide itself uses, so a preload fills the browser cache for it. */
function slideImages(api: Parameters<typeof backdropImageUrl>[0], item: BaseItemDto) {
  return [backdropImageUrl(api, item, { fillWidth: 1920 }), logoImageUrl(api, item, { fillWidth: 800 })].filter((url): url is string => !!url)
}

/**
 * Full-bleed showcase of what the user is watching, cycling through a few titles: backdrop, logo (or title), details
 * and play. Pills at the bottom show which one is up and how long until the next; hovering pauses the rotation.
 */
export function Hero({ items, loading }: HeroProps) {
  const { api } = useAuthedSession()
  const t = useMessages(homeMessages)
  const slides = items.slice(0, MAX_SLIDES)
  const [active, setActive] = useState(0)
  /** The slide shown before the current one; kept mounted while it fades out. */
  const [previous, setPrevious] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  // A new rotation starts each time a slide is shown; the pill's fill animation is keyed on it.
  const [cycle, setCycle] = useState(0)
  const index = slides.length ? active % slides.length : 0

  const nextIndex = slides.length > 1 ? (index + 1) % slides.length : index

  const show = (next: number) => {
    setPrevious(index)
    setActive(next)
    setCycle((value) => value + 1)
  }

  // One slide ahead: load and decode the next slide's images now, so it comes in complete and without a decode hitch.
  const nextItem = slides[nextIndex]
  const nextUrls = nextItem ? slideImages(api, nextItem) : []
  const nextKey = nextUrls.join('|')
  const ready = useRef(new Set<string>())
  useEffect(() => {
    for (const url of nextKey ? nextKey.split('|') : []) {
      if (ready.current.has(url)) continue
      const image = new Image()
      image.src = url
      void image
        .decode()
        .catch(() => undefined)
        .finally(() => ready.current.add(url))
    }
  }, [nextKey])

  useEffect(() => {
    if (slides.length < 2 || paused) return
    let timer = window.setTimeout(function advance(waited = 0) {
      const loaded = nextKey.split('|').every((url) => !url || ready.current.has(url))
      if (loaded || waited >= MAX_WAIT_MS) show(nextIndex)
      else timer = window.setTimeout(() => advance(waited + 200), 200)
    }, SLIDE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, paused, index, cycle, nextKey])

  // A hidden tab shouldn't rotate through titles nobody sees.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Fades out towards the bottom like the real hero does: the rows below overlap its lower edge, and a solid block
  // there would show behind the card placeholders.
  if (loading) return <Skeleton className="h-[68svh] min-h-[420px] rounded-none [mask-image:linear-gradient(to_bottom,#000_45%,transparent_92%)]" />
  if (slides.length === 0) return <div className="h-14" />

  return (
    <section
      aria-roledescription="carousel"
      className="relative h-[68svh] min-h-[420px] overflow-hidden"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Only the current slide, the next one (loading in the background) and the one fading out are mounted. */}
      {slides.map((item, slide) =>
        slide === index || slide === nextIndex || slide === previous ? <Slide key={item.Id} item={item} visible={slide === index} /> : null,
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-24 right-4 z-10 flex items-center gap-1.5 sm:right-8" role="group" aria-label={t.featured}>
          {slides.map((item, slide) => (
            <button
              key={item.Id}
              type="button"
              aria-label={t.showSlide(slide + 1, slides.length)}
              aria-current={slide === index}
              onClick={() => show(slide)}
              className={cn(
                'relative h-1.5 rounded-full bg-white/35 outline-none transition-[width,background-color] duration-300 hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ring',
                // A larger, invisible hit area keeps the slim pills easy to click.
                'after:absolute after:-inset-2 after:content-[""]',
                slide === index ? 'w-6' : 'w-1.5',
              )}
            >
              {slide === index && (
                <span aria-hidden
                  key={cycle}
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  style={{
                    animation: `hero-pill ${SLIDE_MS}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Slide({ item: jellyfinItem, visible }: { item: BaseItemDto; visible: boolean }) {
  const { api } = useAuthedSession()
  // In the interface's language.
  const item = useLocalizedItem(jellyfinItem)
  const t = useMessages(homeMessages)
  const [logoFailed, setLogoFailed] = useState(false)

  const isEpisode = item.Type === 'Episode'
  const title = isEpisode ? item.SeriesName : item.Name
  const ticks = item.UserData?.PlaybackPositionTicks
  const backdrop = backdropImageUrl(api, item, { fillWidth: 1920 })
  const logo = logoImageUrl(api, item, { fillWidth: 800 })
  const overview = plainText(item.Overview)
  const meta = [
    isEpisode ? `S${item.ParentIndexNumber} · E${item.IndexNumber} — ${item.Name}` : item.ProductionYear,
    item.OfficialRating,
    formatRuntime(item.RunTimeTicks),
  ].filter(Boolean)

  return (
    <div
      aria-hidden={!visible}
      // Hidden slides stay mounted (so their images are loaded when they come up) but can't be tabbed into.
      inert={!visible}
      className={cn('absolute inset-0 transition-opacity duration-700 ease-out', visible ? 'opacity-100' : 'pointer-events-none opacity-0')}
    >
      {/* Anchored to the top edge: backdrops are cropped to the banner height, and the top is where faces usually are. */}
      {backdrop && (
        <FadeImage src={backdrop} alt="" className="absolute inset-0 size-full object-cover object-top" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-background/70 via-background/10 to-transparent" />

      <div
        className={cn(
          'absolute inset-x-0 bottom-24 space-y-4 px-4 transition-[opacity,translate] delay-150 duration-500 sm:px-8',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance drop-shadow sm:text-6xl">
          {logo && !logoFailed ? (
            <img
              src={logo}
              alt={title ?? ''}
              onError={() => setLogoFailed(true)}
              className="max-h-28 w-auto max-w-[min(32rem,80vw)] object-contain object-left drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] sm:max-h-36"
            />
          ) : (
            title
          )}
        </h1>
        <p className="text-sm text-foreground/80">{meta.join(' · ')}</p>
        {overview && <p className="line-clamp-3 max-w-xl text-sm text-foreground/80">{overview}</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button size="lg" nativeButton={false} render={<Link to={playHref(item)} />}>
            <IconPlayerPlay /> {ticks ? t.resume : t.play}
          </Button>
          <Button size="lg" variant="secondary" nativeButton={false} render={<Link to={itemHref(item)} />}>
            <IconInfoCircle /> {t.details}
          </Button>
        </div>
      </div>
    </div>
  )
}
