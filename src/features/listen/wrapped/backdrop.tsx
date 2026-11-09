import { useMemo, type CSSProperties } from 'react'
import { random, type Look } from './deck'
import type { Palette } from './slide-kit'

/**
 * The moving, colorful layer behind a slide: drifting color blobs, and one decoration drawn per slide and year
 * (aurora, pulsing rings, rising bubbles, floating shapes, a turning sunburst, zig-zag edges, running stripes, a
 * squiggle). It keeps to the edges and stays soft, so the slide's text reads over it.
 */
export type Decoration = 'aurora' | 'rings' | 'bubbles' | 'geo' | 'sunburst' | 'zigzag' | 'stripes' | 'squiggle'

const DECORATIONS: Decoration[] = ['aurora', 'rings', 'bubbles', 'geo', 'sunburst', 'zigzag', 'stripes', 'squiggle']

/** A number from a text (the slide's id), to draw its decoration with. */
function hash(text: string) {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
}

/** The colors of the year's other palettes, for blobs and shapes that differ from the slide's own. */
function colorsOf(look: Look, palette: Palette) {
  const all = look.palettes.flatMap((entry) => [entry.accent, ...(entry.background.match(/#[0-9a-f]{6}/gi) ?? [])])
  return [palette.accent, ...all.filter((color) => color !== palette.accent && !palette.background.includes(color))]
}

export function Backdrop({ id, year, look, palette }: { id: string; year: number; look: Look; palette: Palette }) {
  const seed = hash(`${id}:${year}`)
  const decoration = DECORATIONS[seed % DECORATIONS.length]!
  const colors = colorsOf(look, palette)
  const pick = (index: number) => colors[(seed + index) % colors.length]!
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Blobs colors={[pick(0), pick(1), pick(2)]} seed={seed} />
      {decoration === 'aurora' && <Aurora colors={[pick(1), pick(2), pick(3), palette.accent]} />}
      {decoration === 'rings' && <Rings color={palette.accent} corner={seed % 4} />}
      {decoration === 'bubbles' && <Bubbles colors={[palette.accent, pick(2)]} seed={seed} />}
      {decoration === 'geo' && <Geo colors={[palette.accent, pick(1), pick(2)]} seed={seed} />}
      {decoration === 'sunburst' && <Sunburst color={palette.accent} />}
      {decoration === 'zigzag' && <Zigzag colors={[palette.accent, pick(2)]} />}
      {decoration === 'stripes' && <Stripes color={palette.accent} />}
      {decoration === 'squiggle' && <Squiggle seed={seed} />}
    </div>
  )
}

/** Three soft color clouds drifting slowly in the corners (blended so they light the slide up). */
function Blobs({ colors, seed }: { colors: string[]; seed: number }) {
  const corners: CSSProperties[] = [
    { top: '-22%', left: '-25%', width: '85%' },
    { bottom: '-25%', right: '-25%', width: '80%', animationDelay: '-7s', animationDuration: '22s' },
    { top: seed % 2 ? '35%' : '55%', right: '-35%', width: '60%', animationDelay: '-3s', animationDuration: '16s' },
  ]
  return (
    <>
      {colors.map((color, index) => (
        <div
          key={index}
          className="wrapped-drift absolute aspect-square rounded-full mix-blend-screen"
          style={{ ...corners[index], background: `radial-gradient(circle, ${color}, transparent 68%)`, opacity: index === 2 ? 0.5 : 0.75 }}
        />
      ))}
    </>
  )
}

/** Four color shapes morphing into each other at the top. */
function Aurora({ colors }: { colors: string[] }) {
  return (
    <div className="absolute inset-x-[-20%] top-[-25%] h-[55%] blur-2xl">
      {colors.map((color, index) => (
        <div
          key={index}
          className="wrapped-aurora absolute size-[55%]"
          style={{ background: color, left: `${index * 22}%`, top: `${(index % 2) * 20}%`, opacity: 0.6, animationDelay: `${index * -2.5}s` }}
        />
      ))}
    </div>
  )
}

/** Rings pulsing out of a corner. */
function Rings({ color, corner }: { color: string; corner: number }) {
  const place: CSSProperties = [{ top: '-30%', left: '-30%' }, { top: '-30%', right: '-30%' }, { bottom: '-30%', right: '-30%' }, { bottom: '-30%', left: '-30%' }][corner]!
  return (
    <div className="absolute size-[110%]" style={place}>
      {[0, 1, 2, 3].map((ring) => (
        <span key={ring} className="wrapped-ring absolute inset-0 rounded-full border-[3px]" style={{ borderColor: color, animationDelay: `${ring * 1.1}s` }} />
      ))}
    </div>
  )
}

/** Circles rising from the bottom edge. */
function Bubbles({ colors, seed }: { colors: string[]; seed: number }) {
  const bubbles = useMemo(() => {
    const next = random(seed)
    // Up the side edges, clear of the text in the middle.
    return Array.from({ length: 12 }, (_, index) => ({ left: index % 2 ? 90 + next() * 8 : -4 + next() * 7, size: 10 + next() * 34, delay: next() * -12, duration: 7 + next() * 7 }))
  }, [seed])
  return (
    <>
      {bubbles.map((bubble, index) => (
        <span
          key={index}
          className="wrapped-bubble absolute -bottom-16 rounded-full"
          style={{
            left: `${bubble.left}%`,
            width: bubble.size,
            height: bubble.size,
            background: index % 3 ? 'transparent' : colors[index % 2],
            border: index % 3 ? `3px solid ${colors[index % 2]}` : undefined,
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
          }}
        />
      ))}
    </>
  )
}

/** Squares, triangles and circles turning and floating along the edges. */
function Geo({ colors, seed }: { colors: string[]; seed: number }) {
  const shapes = useMemo(() => {
    const next = random(seed + 1)
    // In the bands at the top (below the progress bars) and the bottom, clear of the text.
    return Array.from({ length: 9 }, (_, index) => {
      const top = index % 2 === 0
      return {
        left: next() * 88,
        top: top ? 8 + next() * 5 : 86 + next() * 8,
        size: 18 + next() * 34,
        kind: Math.floor(next() * 3),
        delay: next() * -10,
      }
    })
  }, [seed])
  return (
    <>
      {shapes.map((shape, index) => (
        <span
          key={index}
          className="wrapped-tumble absolute"
          style={{
            left: `${shape.left}%`,
            top: `${shape.top}%`,
            width: shape.size,
            height: shape.size,
            background: colors[index % colors.length],
            borderRadius: shape.kind === 0 ? '9999px' : shape.kind === 1 ? '4px' : 0,
            clipPath: shape.kind === 2 ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
            animationDelay: `${shape.delay}s`,
            opacity: 0.85,
          }}
        />
      ))}
    </>
  )
}

/** Rays turning slowly behind the slide from below its middle. */
function Sunburst({ color }: { color: string }) {
  return (
    <div
      className="wrapped-spin absolute top-[55%] left-1/2 aspect-square w-[230%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
      style={{ background: `repeating-conic-gradient(${color} 0 9deg, transparent 9deg 22deg)`, animationDuration: '60s' }}
    />
  )
}

/** Zig-zag bands sliding in at the top and the bottom. */
function Zigzag({ colors }: { colors: string[] }) {
  return (
    <>
      <div className="wrapped-zigzag absolute inset-x-0 top-0 h-20 animate-in slide-in-from-top-full duration-700" style={{ background: colors[0] }} />
      <div className="wrapped-zigzag absolute inset-x-0 bottom-0 h-20 rotate-180 animate-in slide-in-from-bottom-full duration-700" style={{ background: colors[1] }} />
    </>
  )
}

/** A band of stripes running along the bottom. */
function Stripes({ color }: { color: string }) {
  return <div className="wrapped-stripes wrapped-stripes-move absolute inset-x-0 bottom-0 h-24 -skew-y-6 opacity-60" style={{ color }} />
}

/** A hand-drawn loop drawing itself, doubled in two offset colors (chromatic aberration). */
function Squiggle({ seed }: { seed: number }) {
  // Along the bottom edge only, under the slide's content.
  const paths = [
    'M-20 650 C 60 590, 140 700, 220 640 S 360 580, 420 630',
    'M-20 620 C 60 560, 180 700, 250 640 S 360 600, 420 660',
    'M-20 680 C 100 600, 180 660, 260 610 S 360 650, 420 600',
  ]
  const path = paths[seed % paths.length]!
  return (
    <svg viewBox="0 0 400 700" preserveAspectRatio="none" className="absolute inset-0 size-full" fill="none" strokeLinecap="round">
      <path d={path} stroke="#22e1ff" strokeWidth="10" className="wrapped-draw" transform="translate(-5 3)" />
      <path d={path} stroke="#ff3bd4" strokeWidth="10" className="wrapped-draw" transform="translate(5 -3)" />
      <path d={path} stroke="currentColor" strokeWidth="6" className="wrapped-draw" />
    </svg>
  )
}
