/**
 * The change from one slide to the next: drawn per slide and year like the slides themselves, so a story doesn't
 * change the same way every time. Most cover the slide in its color for a moment and uncover the next; `zoom` brings
 * the next one in out of a blur instead.
 */
export type TransitionKind = 'sweep' | 'rise' | 'diagonal' | 'circle' | 'blinds' | 'pincer' | 'spin' | 'zoom'

const KINDS: TransitionKind[] = ['sweep', 'rise', 'diagonal', 'circle', 'blinds', 'pincer', 'spin', 'zoom']

/** A number from a text, to draw with. */
function hash(text: string) {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
}

/** The transition into a slide: never the same as into the one before it. */
export function transitionInto(id: string, previousId: string | undefined, year: number): TransitionKind {
  const pick = (slide: string) => KINDS[hash(`${slide}>${year}`) % KINDS.length]!
  const kind = pick(id)
  return previousId && kind === pick(previousId) ? KINDS[(KINDS.indexOf(kind) + 3) % KINDS.length]! : kind
}

/** The class the next slide's content comes in with (only `zoom` has one; the others are covered while it appears). */
export const enterClass = (kind: TransitionKind) => (kind === 'zoom' ? 'wrapped-enter-zoom' : '')

/** The covering layer over the slide while it changes. */
export function TransitionLayer({ kind, color, second }: { kind: TransitionKind; color: string; second: string }) {
  const base = 'pointer-events-none absolute z-10'
  switch (kind) {
    case 'sweep':
      return <div aria-hidden className={`wrapped-wipe ${base} -inset-x-8 inset-y-0`} style={{ background: color }} />
    case 'rise':
      return <div aria-hidden className={`wrapped-rise ${base} inset-x-0 -inset-y-8`} style={{ background: color }} />
    case 'diagonal':
      return <div aria-hidden className={`wrapped-diagonal ${base} -inset-1/2`} style={{ background: `linear-gradient(135deg, ${color} 45%, ${second} 45%)` }} />
    case 'circle':
      return <div aria-hidden className={`wrapped-circle ${base} inset-0`} style={{ background: color }} />
    case 'blinds':
      return (
        <div aria-hidden className={`${base} inset-0 flex`}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="wrapped-blind h-full flex-1" style={{ background: index % 2 ? second : color, animationDelay: `${index * 45}ms` }} />
          ))}
        </div>
      )
    case 'pincer':
      return (
        <div aria-hidden className={`${base} inset-0`}>
          <div className="wrapped-pincer-top absolute inset-x-0 top-0 h-1/2" style={{ background: color }} />
          <div className="wrapped-pincer-bottom absolute inset-x-0 bottom-0 h-1/2" style={{ background: second }} />
        </div>
      )
    case 'spin':
      return (
        <div aria-hidden className={`${base} inset-0 grid place-items-center overflow-hidden`}>
          <div className="wrapped-spin-cover aspect-square w-[180%]" style={{ background: color }} />
        </div>
      )
    default:
      return null
  }
}
