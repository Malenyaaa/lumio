import { getLocaleTag } from '@/lib/i18n'

const TICKS_PER_SECOND = 10_000_000

export const ticksToSeconds = (ticks: number) => ticks / TICKS_PER_SECOND
export const secondsToTicks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND)

export function formatRuntime(ticks?: number | null): string | undefined {
  if (!ticks) return undefined
  const minutes = Math.round(ticksToSeconds(ticks) / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${m} min` : `${m} min`
}

/** 83 -> "1:23", 5423 -> "1:30:23" */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Star ratings with one decimal in the user's language: 7.25 -> "7.3" / "7,3". */
export function formatRating(value: number): string {
  return new Intl.NumberFormat(getLocaleTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

/** Jellyfin overviews contain HTML (<br>, <i>, entities); show them as plain text with line breaks. */
export function plainText(html?: string | null): string {
  if (!html) return ''
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}
