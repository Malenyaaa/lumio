import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useViewTransitionState } from 'react-router'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { CLOSE_MS, HoverPreview } from '@/components/media/hover-preview'
import { WatchedBadge } from '@/components/media/watched-badge'
import { useAuthedSession } from '@/features/auth/session'
import { useLumioConfig } from '@/features/admin/branding'
import { preloadPreview } from '@/features/items/prefetch'
import { ancestorsOptions } from '@/features/items/queries'
import { useLocalSettings } from '@/features/settings/local-settings'
import { useMessages } from '@/lib/i18n'
import { cardMessages } from './messages'
import { landscapeImageUrl, portraitImageUrl } from '@/lib/images'
import { artistsOf, itemHref, SQUARE_TYPES } from '@/lib/item-links'
import { cn } from '@/lib/utils'
import { useLocalizedItem } from '@/lib/localized'

export type CardShape = 'poster' | 'landscape'

interface MediaCardProps {
  item: BaseItemDto
  shape?: CardShape
  /** Fill the parent's width (grids) instead of using a fixed carousel width. */
  fluid?: boolean
  /** Highlighted as the item currently open (e.g. within its film series). */
  current?: boolean
}

/**
 * Hover timing. The pointer has to rest on a card for the delay from the settings; during that time the preview's content
 * is loaded. If loading is still going on afterwards, the preview waits up to PRELOAD_GRACE_MS more so it never pops in
 * half empty.
 */
/** Preloading starts only once the pointer rests a moment, so sweeping across a row doesn't fetch every card. */
const PRELOAD_AFTER_MS = 150
const PRELOAD_GRACE_MS = 400
const LEAVE_DELAY_MS = 120
/** Length of the exit animation (see HoverPreview); the preview is unmounted after it. */
const EXIT_MS = CLOSE_MS + 20

type Phase = 'closed' | 'open' | 'closing'

function subtitle(item: BaseItemDto): string | undefined {
  if (item.Type === 'Episode') {
    const s = item.ParentIndexNumber, e = item.IndexNumber
    return [s != null && e != null ? `S${s} · E${e}` : null, item.Name].filter(Boolean).join(' — ')
  }
  if (item.Type === 'MusicAlbum' || item.Type === 'Audio') {
    const artists = artistsOf(item).map((artist) => artist.name).join(', ')
    if (artists) return artists
  }
  return item.ProductionYear?.toString()
}

/** Previews are a mouse feature; on touch screens hovering doesn't exist and a tap should just open the item. */
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/**
 * Set by scrolling, cleared by real mouse movement. After a scroll the browser fires pointerenter on whatever card
 * ended up under the resting pointer; without this, the preview that scrolling just closed would pop up again.
 */
let scrolledSinceMove = false
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => (scrolledSinceMove = true), { capture: true, passive: true })
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.movementX || event.movementY) scrolledSinceMove = false
    },
    { passive: true },
  )
}

export function MediaCard({ item: jellyfinItem, shape = 'poster', fluid, current }: MediaCardProps) {
  const { api, session } = useAuthedSession()
  // In the interface's language.
  const item = useLocalizedItem(jellyfinItem)
  const queryClient = useQueryClient()
  const { settings } = useLocalSettings()
  const t = useMessages(cardMessages)
  const hoverDelay = Math.max(settings.hoverDelayMs, PRELOAD_AFTER_MS + 50)
  // Where the admin switched previews off (by media type or library).
  const rules = useLumioConfig().data?.hoverPreview
  const typeAllowed = !rules?.disabledTypes?.includes(item.Type ?? '')
  const disabledLibraries = rules?.disabledLibraries ?? []
  const title = item.Type === 'Episode' ? item.SeriesName : item.Name

  const src = shape === 'landscape' ? landscapeImageUrl(api, item) : portraitImageUrl(api, item)

  const progress = item.UserData?.PlayedPercentage
  const href = itemHref(item)
  // Only the card that was clicked gets the shared name: the same title often sits in several rows at once, and two
  // elements with one view-transition name make the browser skip the transition entirely.
  const [clicked, setClicked] = useState(false)
  const canMorph = shape === 'poster' && item.Type !== 'Episode'
  const morphToDetail = useViewTransitionState(href) && clicked && canMorph

  // Hover preview. `anchor` is the card's screen rectangle; it stays set while the exit animation plays.
  /** The image part of the card; the preview centers on it, not on the card including its caption. */
  const posterRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const exitTimer = useRef<number | undefined>(undefined)
  /** True while the pointer is on the card or its preview; guards the async open against fast mouse movement. */
  const hovering = useRef(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [phase, setPhase] = useState<Phase>('closed')

  const stopTimers = () => {
    opening.current = false
    window.clearTimeout(hoverTimer.current)
    window.clearTimeout(exitTimer.current)
  }

  /** Pointer is (back) on the card or the preview: cancel a pending close, or bring a closing preview back. */
  const keepOpen = () => {
    hovering.current = true
    stopTimers()
    if (phase === 'closing') setPhase('open')
  }

  /** Whether an open is already counting down, so pointer moves on the card don't restart it. */
  const opening = useRef(false)

  const scheduleOpen = () => {
    if (phase !== 'closed') return keepOpen()
    stopTimers()
    hovering.current = true
    opening.current = false
    if (!settings.hoverPreview || !typeAllowed || !canHover() || scrolledSinceMove) return
    opening.current = true
    hoverTimer.current = window.setTimeout(() => {
      const preload = preloadPreview(queryClient, api, session.userId, item)
      // Cards don't know their library; only when some library is excluded is it looked up (once, then cached).
      const libraryAllowed = disabledLibraries.length
        ? queryClient
            .fetchQuery(ancestorsOptions(api, session.userId, item.Id!))
            .then((ancestors) => !ancestors.some((ancestor) => disabledLibraries.includes(ancestor.Id ?? '')))
            .catch(() => true)
        : Promise.resolve(true)
      hoverTimer.current = window.setTimeout(async () => {
        await Promise.race([preload, wait(PRELOAD_GRACE_MS)])
        if (!(await libraryAllowed)) {
          opening.current = false
          return
        }
        opening.current = false
        const rect = posterRef.current?.getBoundingClientRect()
        // Scrolling during the countdown moves the card away from where the preview would be placed.
        if (!hovering.current || !rect || scrolledSinceMove) return
        setAnchor(rect)
        setPhase('open')
      }, hoverDelay - PRELOAD_AFTER_MS)
    }, PRELOAD_AFTER_MS)
  }

  /** Immediately removes the preview (scrolling, navigating), or fades it out first. */
  const dismiss = (animated: boolean) => {
    hovering.current = false
    stopTimers()
    if (!animated || phase === 'closed') {
      setPhase('closed')
      setAnchor(null)
      return
    }
    setPhase('closing')
    exitTimer.current = window.setTimeout(() => {
      setPhase('closed')
      setAnchor(null)
    }, EXIT_MS)
  }

  const scheduleClose = () => {
    hovering.current = false
    stopTimers()
    hoverTimer.current = window.setTimeout(() => dismiss(true), LEAVE_DELAY_MS)
  }

  useEffect(() => stopTimers, [])

  // The preview is positioned in screen coordinates, so anything that moves the card has to remove it.
  useEffect(() => {
    if (phase === 'closed') return
    const closeNow = () => {
      hovering.current = false
      window.clearTimeout(hoverTimer.current)
      window.clearTimeout(exitTimer.current)
      setPhase('closed')
      setAnchor(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      hovering.current = false
      window.clearTimeout(hoverTimer.current)
      setPhase('closing')
      window.clearTimeout(exitTimer.current)
      exitTimer.current = window.setTimeout(closeNow, EXIT_MS)
    }
    window.addEventListener('scroll', closeNow, { capture: true, passive: true })
    window.addEventListener('resize', closeNow)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', closeNow, { capture: true })
      window.removeEventListener('resize', closeNow)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [phase])

  return (
    <>
      <Link
        to={href}
        // The detail page shows this (already loaded) poster while its own data loads, whichever card was used.
        state={canMorph && src ? { poster: src } : undefined}
        onPointerEnter={scheduleOpen}
        // After a scroll the enter event was ignored; the first real move over the card starts the preview.
        onPointerMove={() => {
          if (phase === 'closed' && !opening.current && !scrolledSinceMove) scheduleOpen()
        }}
        onPointerLeave={scheduleClose}
        onClick={() => {
          setClicked(true)
          dismiss(false)
        }}
        className={cn(
          'group/card block rounded-lg outline-none',
          fluid ? 'w-full' : cn('shrink-0', shape === 'poster' ? 'w-36 sm:w-40 lg:w-44' : 'w-64 sm:w-72'),
        )}
      >
        <div
          ref={posterRef}
          className={cn(
            'relative overflow-hidden bg-muted ring-1 ring-border transition',
            // Artists get a round photo, as in music apps; everything else a rounded rectangle.
            item.Type === 'MusicArtist' ? 'rounded-full' : 'rounded-lg',
            'group-focus-visible/card:ring-2 group-focus-visible/card:ring-ring',
            shape === 'poster' ? (SQUARE_TYPES.has(item.Type ?? '') ? 'aspect-square' : 'aspect-[2/3]') : 'aspect-video',
          )}
          style={morphToDetail ? { viewTransitionName: `poster-${item.Id}` } : undefined}
        >
          {src && <FadeImage src={src} alt="" loading="lazy" className="size-full object-cover" />}
          <WatchedBadge item={item} className="absolute right-2 top-2" />
          {current && (
            <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              {t.current}
            </span>
          )}
          {progress != null && progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <p className={cn('mt-2 truncate text-sm font-medium', item.Type === 'MusicArtist' && 'text-center')}>{title}</p>
        <p className={cn('truncate text-xs text-muted-foreground', item.Type === 'MusicArtist' && 'text-center')}>{item.Type === 'MusicArtist' ? t.artist : (subtitle(item) ?? ' ')}</p>
      </Link>

      {anchor &&
        phase !== 'closed' &&
        createPortal(
          <HoverPreview item={item} anchor={anchor} shape={shape} closing={phase === 'closing'} onEnter={keepOpen} onLeave={scheduleClose} />,
          document.body,
        )}
    </>
  )
}
