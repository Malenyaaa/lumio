import { IconArrowRight } from '@tabler/icons-react'
import { Link } from '@/components/link'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { lookFor } from './deck'
import { displayClass, onAccent, paletteStyle } from './slide-kit'
import { useWrappedYears, WRAPPED_RELEASE } from './wrapped-data'

const messages = defineMessages({
  de: { title: (year: number) => `Dein Wrapped ${year} ist da`, line: 'Dein Jahr in Musik, in Bildern zum Durchtippen.', open: 'Ansehen' },
  en: { title: (year: number) => `Your ${year} Wrapped is here`, line: 'Your year in music, to tap through.', open: 'Watch' },
})

/** Wrapped season: from its release in December to the end of January (then the year is still the one before). */
function seasonYear(now: Date) {
  const release = new Date(now.getFullYear(), WRAPPED_RELEASE.month, WRAPPED_RELEASE.day)
  if (now >= release) return now.getFullYear()
  if (now.getMonth() === 0) return now.getFullYear() - 1
  return null
}

/** On Listen's start page in Wrapped season: the year's Wrapped, loud, in its own look. */
export function WrappedBanner() {
  const t = useMessages(messages)
  const years = useWrappedYears()
  const year = seasonYear(new Date())
  if (!year || !years.data?.includes(year)) return null
  const look = lookFor(year)
  const palette = look.palettes[0]!
  const second = look.palettes[1]!
  return (
    <Link
      to={`/listen/wrapped/${year}`}
      // The story opens over the page at once (a page transition would keep the header over it for a moment).
      viewTransition={false}
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl p-5 transition-transform duration-300 hover:scale-[1.01] active:scale-[0.99]"
      style={paletteStyle(palette)}
    >
      <div aria-hidden className="wrapped-burst wrapped-spin absolute -top-16 -right-10 size-48 opacity-90" style={{ background: palette.accent }} />
      <div aria-hidden className="wrapped-drift absolute -bottom-16 left-1/3 size-48 rounded-full" style={{ background: `radial-gradient(circle, ${second.accent}, transparent 70%)` }} />
      <div className="relative min-w-0 flex-1">
        <p className={cn('text-2xl sm:text-3xl', displayClass(look))}>{t.title(year)}</p>
        <p className="mt-1 text-sm font-semibold">{t.line}</p>
      </div>
      <span className="relative flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-sm font-bold" style={{ background: palette.accent, color: onAccent(palette) }}>
        {t.open}
        <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
