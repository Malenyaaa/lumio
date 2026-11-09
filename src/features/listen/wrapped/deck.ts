import type { Wrapped } from './wrapped-data'

/**
 * Which slides a year's Wrapped shows, and in which look. The same for everyone (it follows from the year alone), and
 * different every year, as Spotify's is: each topic (the minutes, the top artist, …) has several slides to choose from,
 * and a year may reuse at most a fifth of the slides of the year before and half of those of the year before that.
 * The core topics come every year (in another slide); the others are drawn.
 *
 * The slides themselves live in ./slides, one per file; each names its topic.
 */
export type Topic =
  | 'intro'
  | 'minutes'
  | 'first-song'
  | 'top-artist'
  | 'top-artists'
  | 'top-song'
  | 'top-songs'
  | 'album'
  | 'repeat'
  | 'discoveries'
  | 'clock'
  | 'months'
  | 'personality'
  | 'comfort'
  | 'streak'
  | 'podcasts'
  | 'summary'

/** The story's order. */
export const TOPICS: Topic[] = [
  'intro',
  'minutes',
  'first-song',
  'personality',
  'top-artist',
  'top-artists',
  'discoveries',
  'top-song',
  'top-songs',
  'repeat',
  'comfort',
  'album',
  'clock',
  'months',
  'streak',
  'podcasts',
  'summary',
]

/** Shown every year (if the year has something for them). */
const CORE: Topic[] = ['intro', 'minutes', 'top-artist', 'top-artists', 'top-song', 'top-songs', 'summary']

/** Of the other topics, this many are drawn each year. */
const OPTIONAL_PER_YEAR = 5

/** At most these shares of a year's slides may come again from one and from two years before. */
const REPEAT_LAST_YEAR = 0.2
const REPEAT_TWO_YEARS = 0.5

/** The year the sequence starts from (each year's choice depends on the two before). */
const FIRST_YEAR = 2010

/** Whether a year's data has anything for a topic (a slide for it would be empty otherwise). */
export function topicAvailable(topic: Topic, data: Wrapped) {
  switch (topic) {
    case 'first-song':
      return !!data.firstTrack
    case 'top-artist':
    case 'top-artists':
      return data.topArtists.length > (topic === 'top-artists' ? 1 : 0)
    case 'top-song':
    case 'top-songs':
      return data.topTracks.length > (topic === 'top-songs' ? 1 : 0)
    case 'album':
      return !!data.topAlbums[0]?.name || !!data.topAlbums[0]?.key && !data.topAlbums[0].key.startsWith('name:')
    case 'repeat':
      return !!data.onRepeat && data.onRepeat.plays >= 3
    case 'discoveries':
      return data.newArtists.count > 0
    case 'podcasts':
      return data.topPodcasts.length > 0
    case 'comfort':
      return !!data.comfort && data.comfort.days >= 4
    case 'streak':
      return !!data.streak && data.streak.days >= 3
    case 'personality':
      return data.plays >= 50 && data.repeatShare > 0
    case 'months':
      return data.months.some((minutes) => minutes > 0)
    default:
      return true
  }
}

/** A small, fast generator of numbers in [0, 1) from a seed (mulberry32). */
export function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const shuffled = <T>(list: T[], next: () => number) => {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(next() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other]!, copy[index]!]
  }
  return copy
}

export interface DeckSlide {
  id: string
  topic: Topic
  /** The first year the slide may be drawn for (slides added later leave the years before as they were). */
  since?: number
}

/** One year's choice: a slide id per topic (all topics, so a year whose data lacks one still has the rest). */
function chooseYear(year: number, all: DeckSlide[], lastYear: Set<string>, twoYears: Set<string>) {
  const slides = all.filter((slide) => (slide.since ?? FIRST_YEAR) <= year)
  const next = random(year * 7919 + 17)
  const optional = shuffled(
    TOPICS.filter((topic) => !CORE.includes(topic)),
    next,
  ).slice(0, OPTIONAL_PER_YEAR)
  const topics = TOPICS.filter((topic) => CORE.includes(topic) || optional.includes(topic))
  const allowedLast = Math.floor(topics.length * REPEAT_LAST_YEAR)
  const allowedTwo = Math.floor(topics.length * REPEAT_TWO_YEARS)
  let fromLast = 0
  let fromTwo = 0
  const chosen = new Map<Topic, string>()
  // Topics with fewer slides choose first (they have the least room).
  const order = shuffled(topics, next).sort((a, b) => slides.filter((slide) => slide.topic === a).length - slides.filter((slide) => slide.topic === b).length)
  for (const topic of order) {
    const candidates = shuffled(
      slides.filter((slide) => slide.topic === topic),
      next,
    )
    if (!candidates.length) continue
    const cost = (id: string) => (lastYear.has(id) ? 2 : 0) + (twoYears.has(id) ? 1 : 0)
    const fits = (id: string) => (!lastYear.has(id) || fromLast < allowedLast) && (!twoYears.has(id) || fromTwo < allowedTwo)
    // Fresh slides first; a repeat only within the allowance; failing that, the least recent.
    const pick = candidates.filter((slide) => fits(slide.id)).sort((a, b) => cost(a.id) - cost(b.id))[0] ?? candidates.sort((a, b) => cost(a.id) - cost(b.id))[0]!
    if (lastYear.has(pick.id)) fromLast += 1
    if (twoYears.has(pick.id)) fromTwo += 1
    chosen.set(topic, pick.id)
  }
  return chosen
}

const cache = new Map<string, Map<Topic, string>>()

/** The slide ids a year shows, per topic (worked out from FIRST_YEAR on, so every year follows from those before). */
export function deckFor(year: number, slides: DeckSlide[]): Map<Topic, string> {
  const signature = slides.map((slide) => slide.id).join(',')
  let before = new Set<string>()
  let last = new Set<string>()
  let result = new Map<Topic, string>()
  for (let current = Math.min(FIRST_YEAR, year); current <= year; current++) {
    const key = `${signature}|${current}`
    let chosen = cache.get(key)
    if (!chosen) {
      chosen = chooseYear(current, slides, last, before)
      cache.set(key, chosen)
    }
    before = last
    last = new Set(chosen.values())
    result = chosen
  }
  return result
}

/** A year's look: its palette and how its headlines are set. */
export interface Look {
  name: string
  /** Background, text and accent colors, used in turn by the slides. */
  palettes: Array<{ background: string; color: string; accent: string }>
  /** The headline face: a heavy sans, a wide display face, or a serif. */
  display: 'sans' | 'wide' | 'serif'
  /** A little grain over the slides. */
  grain: boolean
}

export const LOOKS: Look[] = [
  {
    name: 'pop',
    display: 'sans',
    grain: false,
    palettes: [
      { background: '#2d46b9', color: '#ffffff', accent: '#f573a0' },
      { background: '#f573a0', color: '#1b1340', accent: '#2d46b9' },
      { background: '#1e3264', color: '#ffffff', accent: '#c7f464' },
      { background: '#c7f464', color: '#14213d', accent: '#e8115b' },
      { background: '#e8115b', color: '#ffffff', accent: '#ffc864' },
      { background: '#ffc864', color: '#1a1a1a', accent: '#8d67ab' },
    ],
  },
  {
    name: 'neon',
    display: 'wide',
    grain: true,
    palettes: [
      { background: '#0b0b12', color: '#f4f4f5', accent: '#39ff88' },
      { background: '#120326', color: '#fdf4ff', accent: '#ff3bd4' },
      { background: '#031b1f', color: '#ecfeff', accent: '#22e1ff' },
      { background: '#1a0b00', color: '#fff7ed', accent: '#ff8a1f' },
      { background: '#0b1022', color: '#eef2ff', accent: '#8b7bff' },
    ],
  },
  {
    name: 'editorial',
    display: 'serif',
    grain: true,
    palettes: [
      { background: '#f84a35', color: '#111111', accent: '#eeefe9' },
      { background: '#eeefe9', color: '#272727', accent: '#f84a35' },
      { background: '#8f86f5', color: '#111111', accent: '#dcb301' },
      { background: '#a6e22e', color: '#111111', accent: '#6a00ba' },
      { background: '#272727', color: '#eeefe9', accent: '#a6e22e' },
      { background: '#dcb301', color: '#111111', accent: '#f84a35' },
    ],
  },
  {
    name: 'sunset',
    display: 'sans',
    grain: true,
    palettes: [
      { background: 'linear-gradient(160deg, #c2185b, #6a1b9a)', color: '#ffffff', accent: '#ffe259' },
      { background: 'linear-gradient(160deg, #3446c4, #6a3fc8)', color: '#ffffff', accent: '#ffc8b0' },
      { background: 'linear-gradient(160deg, #0f766e, #065f46)', color: '#ffffff', accent: '#fde68a' },
      { background: 'linear-gradient(160deg, #c2185b, #3949ab)', color: '#ffffff', accent: '#fcff9e' },
      { background: 'linear-gradient(160deg, #f7971e, #ffd200)', color: '#2b1600', accent: '#7a0c3a' },
    ],
  },
  {
    name: 'acid',
    display: 'wide',
    grain: false,
    palettes: [
      { background: '#f1ff47', color: '#111111', accent: '#6a00ba' },
      { background: '#6a00ba', color: '#f1ff47', accent: '#ff8a1e' },
      { background: '#12d861', color: '#111111', accent: '#f774c2' },
      { background: '#f774c2', color: '#1b1340', accent: '#12d861' },
      { background: '#111111', color: '#ffffff', accent: '#f1ff47' },
      { background: '#ff8a1e', color: '#111111', accent: '#6a00ba' },
    ],
  },
]

/** The year's look: drawn by the year, never the same as the year before's. */
export function lookFor(year: number): Look {
  let index = -1
  for (let current = Math.min(FIRST_YEAR, year); current <= year; current++) {
    const drawn = Math.floor(random(current * 104729 + 3)() * LOOKS.length)
    index = drawn === index ? (drawn + 1) % LOOKS.length : drawn
  }
  return LOOKS[index]!
}
