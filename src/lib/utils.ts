export { cn } from "cn"

/**
 * The soft wash of a cover's colour at the top of a page, fading into the page. Mixed with the page's own tone (all of
 * it on dark, about half on light), so black text stays readable on dark covers in the light theme.
 */
export function tintWash(tint: string, to = 'transparent') {
  return `linear-gradient(to bottom, color-mix(in srgb, ${tint} var(--tint-strength), var(--background)) 0%, ${to} 100%)`
}
