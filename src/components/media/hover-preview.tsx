import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconBookmark, IconBookmarkFilled, IconChevronDown, IconPlayerPlay } from '@tabler/icons-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { hoverPreviewMessages } from '@/components/media/messages'
import { RatingBadges } from '@/components/media/rating-badges'
import { WatchedBadge } from '@/components/media/watched-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthedSession } from '@/features/auth/session'
import { useFilmSeries } from '@/features/items/film-series'
import { usePlayTarget } from '@/features/items/play-target'
import { useItem, useSetFavorite } from '@/features/items/queries'
import { formatRuntime, plainText } from '@/lib/format'
import { useMessages } from '@/lib/i18n'
import { landscapeImageUrl } from '@/lib/images'
import { itemHref, playHref, WATCHLIST_TYPES } from '@/lib/item-links'
import { cn } from '@/lib/utils'
import { useLocalizedItem } from '@/lib/localized'

interface HoverPreviewProps {
  item: BaseItemDto
  /** Screen rectangle of the card's image this preview grows out of. */
  anchor: DOMRect
  /** Poster cards are centered on as a whole; on landscape cards the preview image sits right over the card image. */
  shape: 'poster' | 'landscape'
  /** Plays the exit animation; the parent unmounts the preview once it has finished. */
  closing: boolean
  onEnter: () => void
  onLeave: () => void
}

const MIN_WIDTH = 290
const MAX_WIDTH = 380
/** Smallest gap kept to the screen edges; away from the edges the preview sits exactly centered on its card. */
const EDGE = 8
/** How much wider than its card the preview is. */
const GROWTH = 1.35
/** Space the fixed navbar takes at the top. */
const HEADER = 72
/** Rough height of everything below the image, until the rendered preview has been measured. */
const BODY_HEIGHT = 190

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** Open and close durations; the card keeps the preview mounted a little longer than CLOSE_MS (see media-card). */
const OPEN_MS = 280
export const CLOSE_MS = 180
const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)'
const RADIUS = 8

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The card's rectangle as a clip-path inside the preview's rectangle. */
function clipTo(card: DOMRect, box: DOMRect) {
  const top = Math.max(0, card.top - box.top)
  const left = Math.max(0, card.left - box.left)
  const right = Math.max(0, box.right - card.right)
  const bottom = Math.max(0, box.bottom - card.bottom)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${RADIUS}px)`
}

/** Where the card's image sits inside the preview (start) and where the preview's own image is (end). */
function ghostFrames(card: DOMRect, box: DOMRect) {
  return {
    card: { left: `${card.left - box.left}px`, top: `${card.top - box.top}px`, width: `${card.width}px`, height: `${card.height}px` },
    image: { left: '0px', top: '0px', width: `${box.width}px`, height: `${(box.width * 9) / 16}px` },
  }
}

/** Same facts in the same order as the detail page: year · age rating · runtime (or seasons). */
function meta(item: BaseItemDto, t: (typeof hoverPreviewMessages)['de']) {
  const length = item.Type === 'Series' ? (item.ChildCount ? t.seasons(item.ChildCount) : undefined) : formatRuntime(item.RunTimeTicks)
  return [item.ProductionYear ? String(item.ProductionYear) : undefined, item.OfficialRating ?? undefined, length].filter(Boolean) as string[]
}

/**
 * Netflix-style preview: a larger card that comes forward over the one being hovered, with the most useful facts and the
 * two main actions (play, watchlist). Rendered in a portal, positioned in screen coordinates so carousels can't clip it.
 */
export function HoverPreview({ item, anchor, shape, closing, onEnter, onLeave }: HoverPreviewProps) {
  const { api } = useAuthedSession()
  const t = useMessages(hoverPreviewMessages)
  const full = useItem(item.Id!)
  // In the interface's language.
  const data = useLocalizedItem(full.data ?? item)
  const { target, label, verb, detail } = usePlayTarget(data)
  const favorite = useSetFavorite(item.Id!)

  const width = clamp(anchor.width * GROWTH, MIN_WIDTH, MAX_WIDTH)
  const imageHeight = (width * 9) / 16
  // clientWidth excludes the scrollbar, innerWidth does not.
  const left = clamp(anchor.left + anchor.width / 2 - width / 2, EDGE, document.documentElement.clientWidth - width - EDGE)
  // Measured before paint (and again if the content grows), so the preview is centered by its real height.
  const box = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(imageHeight + BODY_HEIGHT)
  const [measured, setMeasured] = useState(false)
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => {
      setHeight(element.offsetHeight)
      setMeasured(true)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  // The morph: the preview is revealed from the card's rectangle outwards while its image travels from the card's spot
  // into the image area. It is always the preview's own (landscape) image: on landscape cards that is the card's image
  // anyway, on posters it starts cropped to the poster's shape. Closing runs the same in reverse. Runs once the final
  // position is known.
  const ghost = useRef<HTMLDivElement>(null)
  /** Title, badge, buttons and text: they appear once the image has (almost) arrived and leave first when closing. */
  const fading = () => [...(box.current?.querySelectorAll<HTMLElement>('[data-morph-content]') ?? [])]
  useLayoutEffect(() => {
    const element = box.current
    if (!measured || !element || reducedMotion()) return
    const rect = element.getBoundingClientRect()
    const frames = ghostFrames(anchor, rect)
    element.animate([{ clipPath: clipTo(anchor, rect) }, { clipPath: `inset(0px 0px 0px 0px round ${RADIUS}px)` }], { duration: OPEN_MS, easing: EASE_OUT })
    for (const content of fading()) {
      content.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: OPEN_MS + 100, easing: 'ease-out' })
    }
    // The preview's own image stays hidden while the travelling copy is on its way. Both are swapped in the same
    // callback when the travel ends (two separate timelines with different easing left a black frame in between).
    const baseImage = element.querySelector<HTMLElement>('[data-morph-image]')
    const travelling = ghost.current
    if (!travelling) return
    if (baseImage) baseImage.style.opacity = '0'
    travelling.style.opacity = '1'
    const travel = travelling.animate([frames.card, frames.image], { duration: OPEN_MS, easing: EASE_OUT, fill: 'forwards' })
    const swap = () => {
      if (baseImage) baseImage.style.opacity = ''
      travelling.style.opacity = '0'
    }
    travel.finished.then(swap, swap)
    // Only on the first measured layout; later size changes (content loading) must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured])
  useLayoutEffect(() => {
    const element = box.current
    if (!closing || !element || reducedMotion()) return
    const rect = element.getBoundingClientRect()
    const frames = ghostFrames(anchor, rect)
    // A landscape card shows the same image as the preview, so it travels back into it. A poster is taller than the
    // image area: the image would grow over everything on its way back, so the preview just folds into the poster's
    // outline and fades.
    const sameShape = shape === 'landscape'
    const shrink = element.animate(
      [
        { clipPath: `inset(0px 0px 0px 0px round ${RADIUS}px)`, opacity: 1 },
        { clipPath: clipTo(anchor, rect), opacity: sameShape ? 1 : 0 },
      ],
      { duration: CLOSE_MS, easing: EASE_IN, fill: 'forwards' },
    )
    const contents = fading().map((content) =>
      content.animate([{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], { duration: CLOSE_MS, fill: 'forwards' }),
    )
    // While the copy travels back, the image at its old spot must not stay behind.
    const baseImage = sameShape ? element.querySelector('[data-morph-image]')?.animate([{ opacity: 0 }, { opacity: 0 }], { duration: CLOSE_MS, fill: 'forwards' }) : undefined
    const ghostImage = ghost.current
    const back = sameShape
      ? ghostImage?.animate(
          [
            { ...frames.image, opacity: 1 },
            { ...frames.card, opacity: 1 },
          ],
          { duration: CLOSE_MS, easing: EASE_IN, fill: 'forwards' },
        )
      : undefined
    // The pointer came back while closing: the preview stays, so undo the half-played close.
    return () => {
      shrink.cancel()
      back?.cancel()
      for (const animation of contents) animation.cancel()
      baseImage?.cancel()
      if (ghostImage) ghostImage.style.opacity = '0'
    }
  }, [closing, anchor, shape])

  const center = anchor.top + anchor.height / 2
  const top = clamp(shape === 'poster' ? center - height / 2 : center - imageHeight / 2, HEADER, window.innerHeight - height - EDGE)

  const isEpisode = data.Type === 'Episode'
  const title = isEpisode ? data.SeriesName : data.Name
  const image = landscapeImageUrl(api, data, { fillWidth: 640 })
  const details = meta(data, t)
  const series = useFilmSeries(data)
  const overview = plainText(data.Overview)
  const saved = !!data.UserData?.IsFavorite
  const canSave = WATCHLIST_TYPES.has(data.Type ?? '')
  const href = itemHref(data)

  return (
    <div
      ref={box}
      role="group"
      aria-label={t.preview(title ?? '')}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={{ position: 'fixed', left, top, width }}
      // Same surface as the app's other popups and cards: rounded-lg, the subtle light ring, popover background.
      className={cn(
        'z-50 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10',
        closing && 'pointer-events-none',
        // Without motion there is no morph; a plain fade instead.
        'motion-reduce:animate-in motion-reduce:fade-in-0',
      )}
    >
      {/* The preview's image with its shade, travelling between the card's spot and the image area (see the morph above). */}
      {image && (
        <div ref={ghost} aria-hidden className="pointer-events-none absolute z-10 overflow-hidden rounded-lg opacity-0 motion-reduce:hidden">
          <img src={image} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-popover via-popover/10 to-transparent" />
          {/* Same corner as on the card, so the badge travels from the card's corner to the preview's. */}
          <WatchedBadge item={data} className="absolute right-2 top-2" />
        </div>
      )}
      <Link to={href} data-morph-image className="relative block aspect-video bg-muted outline-none">
        {image && <FadeImage src={image} alt="" className="size-full object-cover" />}
        {/* Part of the image (not of the fading content): it swaps with the travelling copy's shade in one frame. */}
        <div className="absolute inset-0 bg-linear-to-t from-popover via-popover/10 to-transparent" />
        <WatchedBadge item={data} className="absolute right-2 top-2" />
      </Link>
      {/* The title sits above the travelling image and comes in once it has arrived. */}
      <div data-morph-content className="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-video">
        <p className="absolute inset-x-3 bottom-2 truncate text-base font-semibold drop-shadow">{title}</p>
      </div>

      <div data-morph-content className="space-y-3 p-3 pt-2">
        {/* The detail page's actions, in its button style. */}
        <div className="flex items-center gap-2">
          {target ? (
            // Compact here: the verb, and the episode/track in a muted, shrinkable part (the full text as tooltip).
            <Button size="sm" title={label} className="min-w-0 max-w-[70%]" nativeButton={false} render={<Link to={playHref(target)} />}>
              <IconPlayerPlay />
              {verb}
              {detail && <span className="min-w-0 truncate opacity-60">{detail}</span>}
            </Button>
          ) : (
            <Button size="sm" disabled>
              <IconPlayerPlay /> {t.play}
            </Button>
          )}
          {canSave && (
            <Button
              size="icon-sm"
              variant="outline"
              aria-pressed={saved}
              aria-label={saved ? t.removeFromWatchlist : t.addToWatchlist}
              title={saved ? t.onWatchlist : t.addToWatchlist}
              disabled={favorite.isPending}
              onClick={() => favorite.mutate(!saved)}
            >
              {saved ? <IconBookmarkFilled /> : <IconBookmark />}
            </Button>
          )}
          <div className="flex-1" />
          <Button size="icon-sm" variant="ghost" aria-label={t.details} title={t.details} nativeButton={false} render={<Link to={href} />}>
            <IconChevronDown />
          </Button>
        </div>

        <div className="space-y-1">
          {details.length > 0 && <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>}
          {series && <p className="truncate text-xs text-muted-foreground">{t.seriesPart(series.index + 1, series.films.length, series.name)}</p>}
        </div>

        <RatingBadges item={data} />

        {!!data.Genres?.length && (
          <div className="flex flex-wrap gap-1.5">
            {data.Genres.slice(0, 3).map((genre) => (
              <Badge key={genre} variant="secondary">
                {genre}
              </Badge>
            ))}
          </div>
        )}
        {overview && <p className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{overview}</p>}
      </div>
    </div>
  )
}
