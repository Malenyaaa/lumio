/**
 * Rotten Tomatoes' two states, as in jellyfin-web: a fresh tomato from 60 % on, a green splat below. Drawn inline (no
 * icon set has them) and kept simple enough to read at text size.
 */
export function TomatoIcon({ fresh, className }: { fresh: boolean; className?: string }) {
  if (fresh) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className}>
        <circle cx="12" cy="13.5" r="8.5" fill="#fa320a" />
        <path
          fill="#00912d"
          d="M12 4.2c-1.1-1.6-3-2.1-4.6-1.5 1 .4 1.7 1.1 2 2-1.6-.4-3.3.1-4.3 1.3 1.7-.2 3.2.4 4 1.4-.9.9-1.2 2.2-.8 3.3.6-1.2 1.8-2 3.1-2.1.1 1.3 1 2.4 2.2 2.8-.4-1.1-.2-2.3.5-3.2 1.1.6 2.6.6 3.7-.1-1.2-.4-2-1.3-2.3-2.4 1.1-.5 1.8-1.5 2-2.7-1.2.7-2.5.9-3.5.5z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#0fc755"
        d="M12 2.5l1.6 4.1 3.6-2.6-.6 4.4 4.4-.4-3 3.3 3.8 2.2-4.3 1.1 1.8 4-4.1-1.7-.9 4.4-2.3-3.8-2.3 3.8-.9-4.4-4.1 1.7 1.8-4-4.3-1.1 3.8-2.2-3-3.3 4.4.4-.6-4.4 3.6 2.6z"
      />
    </svg>
  )
}
