import type { CSSProperties } from 'react'
import { Link } from '@/components/link'
import { cn } from '@/lib/utils'
import { lookFor, random } from './deck'
import { accentText, displayClass, onAccent, paletteStyle } from './slide-kit'

/**
 * A year to pick on the Wrapped page, in that year's look (its colors and face) and with a pattern of its own, so no
 * two years look alike.
 */
type Pattern = 'burst' | 'rings' | 'stripes' | 'zigzag' | 'dots' | 'sunburst' | 'blobs'
const PATTERNS: Pattern[] = ['burst', 'rings', 'stripes', 'zigzag', 'dots', 'sunburst', 'blobs']
/** How the year is set: big, skewed, outlined, or its digits stacked. */
type Setting = 'big' | 'skewed' | 'outline' | 'stacked'
const SETTINGS: Setting[] = ['big', 'skewed', 'outline', 'stacked']

export function YearTile({ year, label }: { year: number; label: string }) {
  const look = lookFor(year)
  const next = random(year * 31 + 7)
  const palette = look.palettes[Math.floor(next() * look.palettes.length)]!
  const other = look.palettes[(look.palettes.indexOf(palette) + 1) % look.palettes.length]!
  // Stepping by a number with no common divisor with the count, neighbouring years never share a pattern or setting.
  const pattern = PATTERNS[(year * 3) % PATTERNS.length]!
  const setting = SETTINGS[(year * 3 + 1) % SETTINGS.length]!
  const digits = String(year)
  return (
    <Link
      to={`/listen/wrapped/${year}`}
      // Opened from the list: closing goes back to it (see WrappedStory).
      state={{ keepScroll: true, fromList: true }}
      preventScrollReset
      // The story opens over the page at once: a page transition would keep the header over it for a moment.
      viewTransition={false}
      className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-xl p-4 transition-transform duration-300 hover:-rotate-1 hover:scale-[1.02] active:scale-[0.98]"
      style={paletteStyle(palette)}
    >
      {/* Grows on hover as a whole; the pattern's own motion (turning, drifting) runs inside, untouched by it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-transform duration-700 group-hover:scale-110">
        <TilePattern pattern={pattern} color={palette.accent} second={other.accent} />
      </div>
      <span className="relative self-start rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: palette.accent, color: onAccent(palette) }}>
        {label}
      </span>
      <span className={cn('relative transition-transform duration-500 group-hover:-translate-y-1', displayClass(look))}>
        {setting === 'stacked' ? (
          <span className="block text-6xl leading-[0.8]">
            <span className="block">{digits.slice(0, 2)}</span>
            <span className="block" style={{ color: accentText(palette) }}>
              {digits.slice(2)}
            </span>
          </span>
        ) : setting === 'outline' ? (
          <span className="wrapped-outline block text-6xl" style={{ WebkitTextStrokeColor: palette.color } as CSSProperties}>
            {digits}
          </span>
        ) : setting === 'skewed' ? (
          <span className="block -skew-y-6 text-5xl" style={{ color: accentText(palette) }}>
            {digits}
          </span>
        ) : (
          <span className="block text-5xl">{digits}</span>
        )}
      </span>
    </Link>
  )
}

function TilePattern({ pattern, color, second }: { pattern: Pattern; color: string; second: string }) {
  const common = 'absolute'
  switch (pattern) {
    case 'burst':
      return <div aria-hidden className={cn(common, 'wrapped-burst wrapped-spin -top-8 -right-10 size-44')} style={{ background: color }} />
    case 'rings':
      return <div aria-hidden className={cn(common, 'wrapped-rings -right-16 -bottom-16 size-56 rounded-full opacity-60')} style={{ color }} />
    case 'stripes':
      return <div aria-hidden className={cn(common, 'wrapped-stripes wrapped-stripes-move inset-x-0 top-1/3 h-16 -skew-y-6 opacity-70')} style={{ color }} />
    case 'zigzag':
      return (
        <>
          <div aria-hidden className={cn(common, 'wrapped-zigzag inset-x-0 top-0 h-12')} style={{ background: color }} />
          <div aria-hidden className={cn(common, 'wrapped-zigzag inset-x-0 top-6 h-12 opacity-80')} style={{ background: second }} />
        </>
      )
    case 'dots':
      return <div aria-hidden className={cn(common, 'wrapped-dots inset-0 opacity-50 [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]')} style={{ color }} />
    case 'sunburst':
      return (
        <div
          aria-hidden
          className={cn(common, 'wrapped-spin -top-1/2 -right-1/2 aspect-square w-[200%] opacity-30')}
          style={{ background: `repeating-conic-gradient(${color} 0 10deg, transparent 10deg 24deg)`, animationDuration: '40s' }}
        />
      )
    default:
      return (
        <>
          <div aria-hidden className={cn(common, 'wrapped-drift -top-10 -left-10 size-40 rounded-full')} style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
          <div aria-hidden className={cn(common, 'wrapped-drift -right-12 bottom-10 size-44 rounded-full [animation-delay:-6s]')} style={{ background: `radial-gradient(circle, ${second}, transparent 70%)` }} />
        </>
      )
  }
}
