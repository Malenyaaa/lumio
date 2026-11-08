/** A stable color per user name (same name, same color on every device), dark enough for white initials. */
export function nameColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return `oklch(0.55 0.15 ${Math.abs(hash) % 360})`
}
