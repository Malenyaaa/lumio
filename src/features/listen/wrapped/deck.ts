import type { Wrapped } from './wrapped-data'

/**
 * Which slides a year's Wrapped shows, in which look and order. Two things decide it:
 *
 * - The year: each topic (the minutes, the top artist, …) has several slides to choose from, and a year may reuse at
 *   most a fifth of the slides of the year before and half of those of the year before that. The year also draws which
 *   rankings get a countdown (spotlights: the top three or five artists, songs or albums one by one, each in the same
 *   slide) and how the story's parts are ordered.
 * - The person's year in listening: a topic it has (almost) nothing for is left out (an hour of podcasts makes no
 *   podcast slide), the optional topics are drawn by how much the data has to say about them, and what stands out from
 *   it (an album played over and over, a night owl's hours, …) gets a special slide of its own.
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
  /** One place of a ranking (artists, songs or albums), shown for each place of a countdown. */
  | 'spotlight'
  /** Something that stands out from the year's data; shown only when it does (WrappedSlide `special`). */
  | 'special'

/** The rankings a countdown can go through. */
export type Series = 'artists' | 'songs' | 'albums'

/** The place of a ranking a spotlight slide shows: `rank` 0 is the top, `count` how many the countdown has. */
export interface Spot {
  series: Series
  rank: number
  count: number
}

/** The story's opening and closing topics; the parts between them change their order from year to year. */
const OPENING: Topic[] = ['minutes', 'first-song', 'personality']
/** The parts: the first topic of each leads it, the others follow in the year's order. */
const PARTS: Topic[][] = [
  ['top-artist', 'top-artists', 'discoveries'],
  ['top-song', 'top-songs', 'repeat', 'comfort'],
  ['album', 'podcasts'],
  ['months', 'clock', 'streak'],
]

/** The topics with a slide for every year (when the data has something for them). */
const CORE: Topic[] = ['intro', 'minutes', 'top-artist', 'top-artists', 'top-song', 'top-songs', 'summary']

/** The topics a ranking's countdown takes the place of, and the list it makes needless when it goes five deep. */
const COUNTDOWN_OF: Record<Series, Topic> = { artists: 'top-artist', songs: 'top-song', albums: 'album' }
const LIST_OF: Partial<Record<Series, Topic>> = { artists: 'top-artists', songs: 'top-songs' }

/** The countdowns a year can have (one drawn per year, never the same as the year before's). */
const COUNTDOWNS: Array<Array<{ series: Series; count: number }>> = [
  [{ series: 'artists', count: 5 }],
  [
    { series: 'artists', count: 3 },
    { series: 'songs', count: 3 },
  ],
  [
    { series: 'artists', count: 3 },
    { series: 'albums', count: 3 },
  ],
  [
    { series: 'songs', count: 3 },
    { series: 'albums', count: 3 },
  ],
  [
    { series: 'artists', count: 5 },
    { series: 'songs', count: 3 },
  ],
  [{ series: 'songs', count: 5 }],
]

/** Optional topics a year shows at most (fewer the longer its countdowns), and special slides at most. */
const OPTIONAL_MAX = 6
const SPECIALS_MAX = 2

/** A place of a ranking needs this many minutes for a slide of its own. */
const SPOT_MINUTES = 30

/** At most these shares of a year's slides may come again from one and from two years before. */
const REPEAT_LAST_YEAR = 0.2
const REPEAT_TWO_YEARS = 0.5

/** The year the sequence starts from (each year's choice depends on the two before). */
const FIRST_YEAR = 2010

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/**
 * How much a year's data has to say about a topic: 0 leaves it out (a slide for it would be empty or say next to
 * nothing), 1 is ordinary, more is a topic that stands out (the optional topics are drawn by it).
 */
export function topicWorth(topic: Topic, data: Wrapped): number {
  switch (topic) {
    case 'first-song':
      return data.firstTrack ? 0.9 : 0
    case 'top-artist':
    case 'top-artists':
      return data.topArtists.length > (topic === 'top-artists' ? 1 : 0) ? 1 : 0
    case 'top-song':
    case 'top-songs':
      return data.topTracks.length > (topic === 'top-songs' ? 1 : 0) ? 1 : 0
    case 'album': {
      const top = data.topAlbums[0]
      const named = !!top?.name || (!!top?.key && !top.key.startsWith('name:'))
      return named && top!.minutes >= 60 ? 1 + Math.min(2, (top!.minutes / Math.max(1, data.minutes)) * 10) : 0
    }
    case 'repeat':
      return data.onRepeat && data.onRepeat.plays >= 5 ? Math.min(3, data.onRepeat.plays / 6) : 0
    case 'discoveries':
      return data.newArtists.count >= 3 ? 0.8 + Math.min(2, (data.newArtists.count / Math.max(1, data.artists)) * 2) : 0
    case 'podcasts':
      // An hour or two over the whole year is no podcast year.
      return data.podcastMinutes >= 120 && data.topPodcasts.length > 0 ? 1 + Math.min(2, (data.podcastMinutes / Math.max(1, data.minutes)) * 5) : 0
    case 'comfort':
      return data.comfort && data.comfort.days >= 10 ? Math.min(3, data.comfort.days / 25) : 0
    case 'streak':
      return data.streak && data.streak.days >= 7 ? Math.min(3, data.streak.days / 21) : 0
    case 'personality':
      return data.plays >= 50 && data.repeatShare > 0 ? 1 : 0
    case 'months': {
      const active = data.months.filter((minutes) => minutes > 0).length
      if (active < 3) return 0
      return 1 + Math.min(2, Math.max(...data.months) / (sum(data.months) / 12) - 1)
    }
    case 'clock':
      return sum(data.hours) > 0 ? 1 : 0
    case 'spotlight':
    case 'special':
      return 0
    default:
      return 1
  }
}

/** The places of a ranking with enough minutes for a slide each (0 = the top), up to `count`. */
export function spotsOf(series: Series, data: Wrapped, count: number) {
  const list = series === 'artists' ? data.topArtists : series === 'songs' ? data.topTracks : data.topAlbums
  let places = 0
  while (places < Math.min(count, list.length) && list[places]!.minutes >= SPOT_MINUTES) places++
  return places
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

/** A number from a text, to draw with. */
function hash(text: string) {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
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
  /** A spotlight: the rankings it can show a place of. */
  series?: Series[]
  /** A special: how much the year stands out for it (below 1: not enough for the slide). */
  special?: (data: Wrapped) => number
  /** A special: the topic it follows in the story (at the end of that topic's part when the topic isn't shown). */
  after?: Topic
}

/** What a year draws, whoever's year it is: a slide per topic, a slide per ranking's countdown, the countdowns, the order. */
interface YearPlan {
  designs: Map<Topic, string>
  spotlights: Map<Series, string>
  countdowns: Array<{ series: Series; count: number }>
  order: Topic[]
}

/** The slide drawn for a topic or ranking: fresh ones first, a repeat only within the allowance, else the least recent. */
function picker(lastYear: Set<string>, twoYears: Set<string>, allowedLast: number, allowedTwo: number, next: () => number) {
  let fromLast = 0
  let fromTwo = 0
  return (candidates: DeckSlide[]) => {
    if (!candidates.length) return undefined
    const cost = (id: string) => (lastYear.has(id) ? 2 : 0) + (twoYears.has(id) ? 1 : 0)
    const fits = (id: string) => (!lastYear.has(id) || fromLast < allowedLast) && (!twoYears.has(id) || fromTwo < allowedTwo)
    const pool = shuffled(candidates, next)
    const pick = pool.filter((slide) => fits(slide.id)).sort((a, b) => cost(a.id) - cost(b.id))[0] ?? pool.sort((a, b) => cost(a.id) - cost(b.id))[0]!
    if (lastYear.has(pick.id)) fromLast += 1
    if (twoYears.has(pick.id)) fromTwo += 1
    return pick
  }
}

function planYear(year: number, all: DeckSlide[], lastYear: Set<string>, twoYears: Set<string>, lastCountdown: number): YearPlan & { countdown: number } {
  const slides = all.filter((slide) => (slide.since ?? FIRST_YEAR) <= year)
  const next = random(year * 7919 + 17)
  const topics = [...OPENING, ...PARTS.flat(), 'intro', 'summary'] as Topic[]
  const allowedLast = Math.floor((topics.length + 3) * REPEAT_LAST_YEAR)
  const allowedTwo = Math.floor((topics.length + 3) * REPEAT_TWO_YEARS)
  const pick = picker(lastYear, twoYears, allowedLast, allowedTwo, next)
  const designs = new Map<Topic, string>()
  // Topics with fewer slides choose first (they have the least room).
  const count = (topic: Topic) => slides.filter((slide) => slide.topic === topic).length
  for (const topic of shuffled(topics, next).sort((a, b) => count(a) - count(b))) {
    const chosen = pick(slides.filter((slide) => slide.topic === topic))
    if (chosen) designs.set(topic, chosen.id)
  }
  // Each ranking its own spotlight slide (two countdowns of a year never look alike).
  const spotlights = new Map<Series, string>()
  for (const series of shuffled<Series>(['artists', 'songs', 'albums'], next)) {
    const taken = new Set(spotlights.values())
    const fitting = slides.filter((slide) => slide.topic === 'spotlight' && slide.series?.includes(series))
    const chosen = pick(fitting.filter((slide) => !taken.has(slide.id))) ?? pick(fitting)
    if (chosen) spotlights.set(series, chosen.id)
  }
  let countdown = Math.floor(next() * COUNTDOWNS.length)
  if (countdown === lastCountdown) countdown = (countdown + 1 + Math.floor(next() * (COUNTDOWNS.length - 1))) % COUNTDOWNS.length
  // The order: the opening and the parts shuffled, each part led by its first topic.
  const parts = shuffled(PARTS, next).map(([lead, ...rest]) => [lead!, ...shuffled(rest, next)])
  const order: Topic[] = ['intro', ...shuffled(OPENING, next), ...parts.flat(), 'summary']
  return { designs, spotlights, countdowns: COUNTDOWNS[countdown]!, order, countdown }
}

const cache = new Map<string, YearPlan & { countdown: number }>()

/** A year's plan (worked out from FIRST_YEAR on, so every year follows from those before). */
export function planFor(year: number, slides: DeckSlide[]): YearPlan {
  const signature = slides.map((slide) => slide.id).join(',')
  let before = new Set<string>()
  let last = new Set<string>()
  let lastCountdown = -1
  let result: (YearPlan & { countdown: number }) | undefined
  for (let current = Math.min(FIRST_YEAR, year); current <= year; current++) {
    const key = `${signature}|${current}`
    let plan = cache.get(key)
    if (!plan) {
      plan = planYear(current, slides, last, before, lastCountdown)
      cache.set(key, plan)
    }
    before = last
    last = new Set([...plan.designs.values(), ...plan.spotlights.values()])
    lastCountdown = plan.countdown
    result = plan
  }
  return result!
}

/** One slide of a story: the slide, and for a spotlight the place it shows. `key` tells the story's slides apart. */
export interface StorySlide<S extends DeckSlide = DeckSlide> {
  key: string
  slide: S
  spot: Spot | null
}

/**
 * A person's story for a year: the year's plan, applied to their data. The core topics come when the data has them;
 * of the others, those the data says most about (with the year's chance in it); the year's countdowns where their
 * ranking goes deep enough; the specials the year stands out for most.
 */
export function storyFor<S extends DeckSlide>(data: Wrapped, slides: S[]): Array<StorySlide<S>> {
  const plan = planFor(data.year, slides)
  const next = random(data.year * 31337 + 5)
  const byId = new Map(slides.map((slide) => [slide.id, slide]))
  const countdowns = plan.countdowns.map((countdown) => ({ ...countdown, count: spotsOf(countdown.series, data, countdown.count) })).filter((countdown) => countdown.count >= 2)
  const replaced = new Map(countdowns.map((countdown) => [COUNTDOWN_OF[countdown.series], countdown]))
  const needless = new Set(countdowns.filter((countdown) => countdown.count >= 5).map((countdown) => LIST_OF[countdown.series]))
  const spotSlides = sum(countdowns.map((countdown) => countdown.count))

  const worth = new Map(plan.order.map((topic) => [topic, topicWorth(topic, data)]))
  const optional = plan.order
    .filter((topic) => !CORE.includes(topic) && !replaced.has(topic) && worth.get(topic)! > 0)
    .map((topic) => ({ topic, draw: worth.get(topic)! * (0.55 + 0.9 * next()) }))
    .sort((a, b) => b.draw - a.draw)
    .slice(0, Math.max(3, OPTIONAL_MAX - Math.floor(spotSlides / 3)))
    .map((entry) => entry.topic)
  const shown = (topic: Topic) => replaced.has(topic) || (!needless.has(topic) && (CORE.includes(topic) || optional.includes(topic)) && worth.get(topic)! > 0)

  // The specials the year stands out for most, each after its topic (or its part's end).
  const specials = slides
    .filter((slide) => slide.topic === 'special' && slide.special && (slide.since ?? FIRST_YEAR) <= data.year)
    .map((slide) => ({ slide, strength: slide.special!(data) }))
    .filter((entry) => entry.strength >= 1)
    .map((entry) => ({ ...entry, draw: entry.strength * (0.8 + 0.4 * random(hash(`${entry.slide.id}:${data.year}`))()) }))
    .sort((a, b) => b.draw - a.draw)
    .slice(0, SPECIALS_MAX)
    .map((entry) => entry.slide)
  const partOf = (topic: Topic) => PARTS.find((part) => part.includes(topic)) ?? [topic]

  const story: Array<StorySlide<S>> = []
  for (const topic of plan.order) {
    const countdown = replaced.get(topic)
    const spotlight = countdown && byId.get(plan.spotlights.get(countdown.series) ?? '')
    if (countdown && spotlight) {
      // Counting down: the last place first, the top at the end.
      for (let rank = countdown.count - 1; rank >= 0; rank--) story.push({ key: `${spotlight.id}:${countdown.series}:${rank}`, slide: spotlight, spot: { series: countdown.series, rank, count: countdown.count } })
    } else if (shown(topic)) {
      const slide = byId.get(plan.designs.get(topic) ?? '')
      if (slide) story.push({ key: slide.id, slide, spot: null })
    }
    // A special comes after its topic; one whose topic isn't shown, after the last shown topic of that part.
    for (const special of specials) {
      const after = special.after ?? 'minutes'
      const part = partOf(after)
      const lastShown = [...plan.order].reverse().find((other) => part.includes(other) && shown(other))
      if (shown(after) ? topic === after : topic === (lastShown ?? part.at(-1))) story.push({ key: special.id, slide: special, spot: null })
    }
  }
  return story
}

/** A slide on its own (`?slide=<id>`, for working on the slides): a spotlight at the place asked for, else the top. */
export function singleSlide<S extends DeckSlide>(slide: S, series: string | null, rank: number): StorySlide<S> {
  const chosen = (slide.series ?? []).find((entry) => entry === series) ?? slide.series?.[0]
  return { key: slide.id, slide, spot: chosen ? { series: chosen, rank, count: Math.max(3, rank + 1) } : null }
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
