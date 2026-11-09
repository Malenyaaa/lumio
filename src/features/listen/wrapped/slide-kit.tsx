import '@fontsource/archivo-black/latin-400.css'
import '@fontsource/figtree/latin-900.css'
import './wrapped.css'
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { FadeImage } from '@/components/media/fade-image'
import { useAuthedSession } from '@/features/auth/session'
import { useItem } from '@/features/items/queries'
import { useArtistPhoto } from '@/features/listen/artist-photo'
import { useArtistLookup } from '@/features/listen/credits'
import { getLocaleTag, useLocale } from '@/lib/i18n'
import { portraitImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import type { Look, Topic } from './deck'
import { inLibrary, useSpotifyCover, type Wrapped, type WrappedTrack } from './wrapped-data'

/**
 * What every Wrapped slide is made of: its props, and the pieces they share (entrances, counters, pictures of songs,
 * albums and artists, the year's headline face). The slides themselves are in ./slides, one per file.
 */
export type Palette = Look['palettes'][number]

export interface SlideProps {
  data: Wrapped
  look: Look
  /** This slide's colors (the look's palettes in turn). */
  palette: Palette
  /** The slide is the one shown (counters and the like start then). */
  active: boolean
}

export interface WrappedSlide {
  /** Stable: it decides which years show the slide. */
  id: string
  topic: Topic
  /** The first year it may be drawn for: a slide added later names the coming year, so years already out stay. */
  since?: number
  Component: (props: SlideProps) => ReactNode
}

export function useFormats() {
  const locale = getLocaleTag(useLocale())
  return {
    locale,
    number: new Intl.NumberFormat(locale),
    compact: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    day: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }),
    month: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }),
    shortMonth: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }),
  }
}

/** A "YYYY-MM-DD" date as a Date (UTC midnight; format it in UTC). */
export const dateOf = (value: string) => new Date(`${value}T00:00:00Z`)

/** The class for the year's headline face. */
export function displayClass(look: Look) {
  return look.display === 'wide'
    ? 'font-[Archivo_Black] tracking-tight uppercase'
    : look.display === 'serif'
      ? 'font-serif italic font-black tracking-tight'
      : 'font-extrabold tracking-tighter'
}

/** The slide's content area: clear of the progress bars on top and the edge below. */
export function Body({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cn('relative z-10 flex h-full flex-col px-7 pt-[calc(max(0.75rem,var(--safe-top))+4.5rem)] pb-[max(2.5rem,var(--safe-bottom))]', className)} style={style}>
      {children}
    </div>
  )
}

/** A headline in the year's face. */
export function Headline({ look, className, children }: { look: Look; className?: string; children: ReactNode }) {
  return <p className={cn('leading-[0.95]', displayClass(look), className)}>{children}</p>
}

/** The slide's own background and text color (a palette may be a gradient). */
export function paletteStyle(palette: Palette): CSSProperties {
  return { background: palette.background, color: palette.color }
}

/** A color to set on the accent: the slide's background when it is a plain color, else near black. */
export const onAccent = (palette: Palette) => (palette.background.startsWith('#') ? palette.background : '#111111')

const reducedMotion =() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts up to `value` once shown (the big numbers). */
export function useCountUp(value: number, active: boolean, ms = 1400, delay = 0) {
  const [shown, setShown] = useState(0)
  const still = reducedMotion()
  useEffect(() => {
    if (!active || still) return
    const start = performance.now() + delay
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.max(0, Math.min(1, (now - start) / ms))
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [value, active, ms, delay, still])
  return still ? value : shown
}

type Entrance = 'rise' | 'fall' | 'left' | 'right' | 'zoom' | 'fade' | 'spin'

const ENTRANCES: Record<Entrance, string> = {
  rise: 'slide-in-from-bottom-8',
  fall: 'slide-in-from-top-8',
  left: 'slide-in-from-left-12',
  right: 'slide-in-from-right-12',
  zoom: 'zoom-in-50',
  fade: '',
  spin: 'spin-in-12 zoom-in-75',
}

/** Comes in (from below by default) after `delay` ms. */
export function In({ delay = 0, from = 'rise', className, style, children }: { delay?: number; from?: Entrance; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={cn('animate-in fade-in-0 duration-700 ease-out fill-mode-both', ENTRANCES[from], className)} style={{ animationDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

/** A line of text whose words (or letters) come in one after another. */
export function Stagger({ text, by = 'word', delay = 0, step = 70, className }: { text: string; by?: 'word' | 'letter'; delay?: number; step?: number; className?: string }) {
  const parts = by === 'word' ? text.split(/(\s+)/) : [...text]
  // Each visible part's place in the order (spaces don't count).
  const order = parts.map((_, position) => parts.slice(0, position).filter((part) => !/^\s+$/.test(part)).length)
  return (
    <span className={className} aria-label={text}>
      {parts.map((part, position) =>
        /^\s+$/.test(part) ? (
          <span key={position}>{part}</span>
        ) : (
          <span
            key={position}
            aria-hidden
            className="wrapped-pop inline-block"
            style={{ animationDelay: `${delay + order[position]! * step}ms` }}
          >
            {part}
          </span>
        ),
      )}
    </span>
  )
}

/** Text running across the slide without end (both directions with `reverse`). */
export function Marquee({ text, reverse, className, speed = 18 }: { text: string; reverse?: boolean; className?: string; speed?: number }) {
  const line = `${text} · `.repeat(6)
  return (
    <div aria-hidden className={cn('overflow-hidden whitespace-nowrap', className)}>
      <div className={cn('inline-block', reverse ? 'wrapped-marquee-reverse' : 'wrapped-marquee')} style={{ animationDuration: `${speed}s` }}>
        <span>{line}</span>
        <span>{line}</span>
      </div>
    </div>
  )
}

/** A picture (cover or photo) or, without one, a shape in the slide's accent. */
export function Picture({ src, round, className, style }: { src: string | undefined; round?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('overflow-hidden bg-black/20 shadow-2xl', round ? 'rounded-full' : 'rounded-md', className)} style={style}>
      {src && <FadeImage key={src} src={src} alt="" className="size-full object-cover" draggable={false} />}
    </div>
  )
}

/** A little film grain over the slide (looks that want it). */
export function Grain() {
  return <div aria-hidden className="wrapped-grain pointer-events-none absolute inset-0 z-0 opacity-[0.12] mix-blend-overlay" />
}

/** A song's cover: the library's song, or its album; else Spotify's for a song imported from there. */
export function useTrackCover(track: Pick<WrappedTrack, 'key' | 'contextId'> | null | undefined, size = 480) {
  const { api } = useAuthedSession()
  const own = useItem(track?.key ?? '', inLibrary(track?.key))
  const album = useItem(track?.contextId ?? '', !own.data && inLibrary(track?.contextId))
  const spotify = useSpotifyCover(track?.key)
  const item = own.data ?? album.data
  return item ? portraitImageUrl(api, item, { fillHeight: size }) : spotify
}

/** An album's cover and names: the library's, else from one of its songs (Spotify's, for one only known from there). */
export function useAlbum(album: Wrapped['topAlbums'][number] | undefined, size = 480) {
  const { api } = useAuthedSession()
  const own = useItem(album?.key ?? '', inLibrary(album?.key))
  const sample = useTrackCover(own.data ? undefined : album && { key: album.sampleKey, contextId: null }, size)
  return {
    cover: own.data ? portraitImageUrl(api, own.data, { fillHeight: size }) : sample,
    name: own.data?.Name ?? album?.name ?? '',
    artist: own.data?.AlbumArtist ?? album?.artist ?? null,
  }
}

/** An artist's photo: the library's artist when there is one, else one from outside. */
export function useArtistImage(name: string | undefined, size = 480) {
  const lookup = useArtistLookup()
  const id = name ? lookup(name).id : undefined
  const item = useItem(id ?? '', !!id)
  const artist: BaseItemDto = item.data ?? { Name: name, Type: 'MusicArtist' }
  return useArtistPhoto(name ? artist : undefined, size)
}

/** The part of the day with the most music: morning 5–11, afternoon 11–17, evening 17–22, night 22–5. */
export function partOfDay(hours: number[]) {
  const parts = { morning: [5, 11], afternoon: [11, 17], evening: [17, 22], night: [22, 29] } as const
  return Object.entries(parts)
    .map(([name, [from, to]]) => {
      let sum = 0
      for (let hour = from; hour < to; hour++) sum += hours[hour % 24] ?? 0
      return { name: name as keyof typeof parts, sum: sum / (to - from) }
    })
    .sort((a, b) => b.sum - a.sum)[0]!.name
}

/** Minutes as hours or days, when that says more. */
export function inHours(minutes: number) {
  return { hours: Math.round(minutes / 60), days: Math.round((minutes / 60 / 24) * 10) / 10 }
}
