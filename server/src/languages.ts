/**
 * Films and series in two languages. Jellyfin keeps one title, overview and tagline per item, in whatever language the
 * library fetched them (mostly German here, but not always). Lumio finds out which language that text is in (by words
 * only one of the languages has), fetches the other language from TMDb, and keeps both (see Store.localized); the app
 * then shows the one matching its interface, and whatever there is when only one exists. Posters and logos with
 * writing on them come from TMDb in the other language too; an administrator can label, rewrite and pick by hand.
 */

export type Lang = 'de' | 'en'
export const LANGS: Lang[] = ['de', 'en']

/** The language of the text Jellyfin has: one of the two, unclear (both or too few words), or none (no text). */
export type Label = Lang | 'unclear' | 'none'

export interface Texts {
  name?: string
  overview?: string
  tagline?: string
}

/** The pictures that carry writing, which can differ by language; backdrops and the rest are shared. */
export const LOCAL_IMAGE_KINDS = ['Primary', 'Logo', 'Thumb', 'Banner'] as const
export type LocalImageKind = (typeof LOCAL_IMAGE_KINDS)[number]

/** A picture for one language: an https address, or `upload:<file>` (uploaded by an administrator). */
export interface LocalImage {
  src: string
  /** Picked by an administrator; the task never replaces it. */
  manual?: boolean
  at: number
}

export interface Localized {
  label: Label
  /** Set by an administrator; the task keeps it. */
  labelManual?: boolean
  /** The texts TMDb has, per language. */
  tmdb: Partial<Record<Lang, Texts>>
  /** When TMDb was asked (never: there was no key, only the label was found). */
  tmdbAt?: number
  /** Texts an administrator wrote; they win over everything. */
  edited: Partial<Record<Lang, Texts>>
  /** Pictures per language; null: Jellyfin's, chosen by an administrator (no automatic one either). */
  images: Partial<Record<Lang, Partial<Record<LocalImageKind, LocalImage | null>>>>
}

/** What the item is, for the administrators' lists. */
export interface LocalizedMeta {
  name: string
  type: string
  series?: string
  year?: number
  season?: number
  episode?: number
}

// ---- which language a text is in ----

/**
 * Words only German has (none of them is also an English word, unlike "in", "die", "was", "her" or "will"), and words
 * only English has (none of them German, unlike "an", "also" or "hat").
 */
const GERMAN = new Set(
  (
    'und der das dem des ein eine einen einem einer eines er sie es ist sind nicht sich mit für auf aus bei nach von vom zum zur beim um zu ' +
    'wird werden wurde wurden seine seinen seiner seinem ihre ihren ihrer ihrem ihm ihn auch durch über zwischen dass daß wenn aber oder ' +
    'schon noch immer gegen kann muss muß soll doch jedoch selbst wieder dabei dort ohne seit bis alle sein ihr wie als unter neue neuen ' +
    'diese dieser diesem diesen eigenen jahre jahren gemeinsam während ihnen sowie welche welcher ich mich mir wir uns euch kein keine ' +
    'keinen allen nur vor viel vielleicht nichts etwas sehr mehr nun endlich dann denn weil damit ganz jetzt zwei drei beiden'
  ).split(' '),
)
const ENGLISH = new Set(
  (
    'the and of to is are with his their they them from which who whose this that these those has have had been would could should about ' +
    'after before into while when where what there its it he she him be by on at for but not one can must out up over then than only ' +
    'other more becomes finds himself herself themselves being every new life family young world back through against between during does ' +
    'did just story gets takes comes finally soon you your we our my under within without across each'
  ).split(' '),
)

const isCapital = (word: string | undefined) => !!word && word !== word.toLowerCase()

/** Small English words that join the parts of a name ("Congress of the United States"). */
const JOINERS = new Set(['of', 'the', 'and', 'for', 'on', 'at', 'to', 'with'])

/**
 * The language of a text: German when several words only German has turn up and none only English has, and the other
 * way round; unclear otherwise. Names and titles of the other language inside a text don't count: anything in quotes
 * („Words with Friends“), words joined by hyphens (Coming-out, Game-of-Thrones), and capitalised words except at a
 * sentence's start. English words also don't count between capitalised ones (Bureau of Investigation, Dungeons and
 * Dragons), nor capitalised before another capitalised one ("New York", "The Dark Knight").
 */
export function detectLanguage(text: string | null | undefined): Label {
  const plain = (text ?? '').replace(/<[^>]+>/g, ' ')
  if (!plain.trim()) return 'none'
  // Quoted titles are left out (up to a line's length, so an unclosed quote doesn't swallow the rest).
  const unquoted = plain.replace(/[„“"«»‚‘][^„“"«»‚‘\n]{0,120}[“”"«»‘’]/g, ' . ')
  const matches = [...unquoted.matchAll(/\p{L}+(?:['’-]\p{L}+)*/gu)]
  const tokens = matches.map((match, index) => {
    const previous = matches[index - 1]
    return {
      word: match[0],
      sentenceStart: /(^|[.!?:;…(–])\s*$/.test(unquoted.slice(Math.max(0, match.index - 3), match.index)),
      // Only spaces since the word before: the two can be parts of one name.
      joined: !!previous && /^\s+$/.test(unquoted.slice(previous.index + previous[0].length, match.index)),
    }
  })
  const german = new Set<string>()
  const english = new Set<string>()
  /** The next word in a direction that isn't a lowercase joiner, as long as only spaces lie between. */
  const beyond = (index: number, step: 1 | -1) => {
    let at = index
    for (;;) {
      if (!(step === 1 ? tokens[at + 1]?.joined : tokens[at]?.joined)) return undefined
      at += step
      if (!JOINERS.has(tokens[at]!.word)) return tokens[at]
    }
  }
  tokens.forEach(({ word, sentenceStart }, index) => {
    const lower = word.toLowerCase()
    const before = beyond(index, -1)
    const after = tokens[index + 1]?.joined ? tokens[index + 1]!.word : undefined
    if (isCapital(word) && !sentenceStart) return
    if (GERMAN.has(lower)) german.add(lower)
    // English names and titles are common in German texts (German nouns being capitalised, the same test would drop
    // German words between them, so it is for English only).
    else if (ENGLISH.has(lower) && !(isCapital(word) ? isCapital(after) : isCapital(before?.word) && isCapital(beyond(index, 1)?.word) && !before?.sentenceStart)) english.add(lower)
  })
  if (german.size >= 2 && !english.size) return 'de'
  if (english.size >= 2 && !german.size) return 'en'
  return 'unclear'
}

// ---- TMDb ----

/** What Jellyfin says about a film, series, season or episode (the fields the task reads). */
export interface VideoItem {
  Id: string
  Type?: string
  Name?: string
  Overview?: string
  Taglines?: string[]
  ProviderIds?: Record<string, string>
  ProductionYear?: number
  SeriesId?: string
  SeriesName?: string
  IndexNumber?: number
  ParentIndexNumber?: number
}

export interface LanguageDeps {
  /** Whether TMDb can be asked (there is a key); without, the task only labels the texts. */
  canTmdb: boolean
  /** A TMDb answer through the relay; null when TMDb doesn't know it. Throws when TMDb can't answer. */
  tmdb: (path: string, params: Record<string, string>) => Promise<unknown>
  /** A Jellyfin answer, read with the caller's token (`{user}` in the path is the caller). */
  jellyfin: <T>(path: string, query: Record<string, string>) => Promise<T>
  get: (ids: string[]) => Record<string, Localized>
  put: (id: string, data: Localized, meta: LocalizedMeta) => void
}

const TMDB_LANGUAGE: Record<Lang, string> = { de: 'de-DE', en: 'en-US' }
/** TMDb's picture sizes: posters and thumbs a little larger than any card, logos as the hero shows them. */
const TMDB_SIZE: Record<LocalImageKind, string> = { Primary: 'w780', Logo: 'w500', Thumb: 'w780', Banner: 'original' }

type TmdbImage = { iso_639_1?: string | null; file_path?: string; vote_average?: number; vote_count?: number }

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

function texts(data: unknown, nameKey: 'title' | 'name'): Texts {
  const entry = (data ?? {}) as Record<string, unknown>
  return { name: text(entry[nameKey]), overview: text(entry.overview), tagline: text(entry.tagline) }
}

/** TMDb's best-rated poster and logo in each language (only ones with writing in that language, not language-free ones). */
function bestImages(data: unknown): Partial<Record<Lang, Partial<Record<LocalImageKind, string>>>> {
  const images = (data ?? {}) as { posters?: TmdbImage[]; logos?: TmdbImage[] }
  const result: Partial<Record<Lang, Partial<Record<LocalImageKind, string>>>> = {}
  for (const lang of LANGS) {
    for (const [kind, list] of [
      ['Primary', images.posters],
      ['Logo', images.logos],
    ] as const) {
      const best = (list ?? [])
        .filter((image) => image.iso_639_1 === lang && image.file_path)
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0) || (b.vote_count ?? 0) - (a.vote_count ?? 0))[0]
      if (best) (result[lang] ??= {})[kind] = `https://image.tmdb.org/t/p/${TMDB_SIZE[kind]}${best.file_path}`
    }
  }
  return result
}

/**
 * The item's new entry: the label found again (unless an administrator set it), TMDb's texts, and the automatic
 * pictures replaced by the new ones; what an administrator wrote or picked stays.
 */
function merged(
  existing: Localized | undefined,
  jellyfinText: string | undefined,
  tmdb: Partial<Record<Lang, Texts>> | null,
  auto: Partial<Record<Lang, Partial<Record<LocalImageKind, string>>>>,
): Localized {
  const images: Localized['images'] = {}
  for (const lang of LANGS) {
    const kept: Partial<Record<LocalImageKind, LocalImage | null>> = {}
    for (const kind of LOCAL_IMAGE_KINDS) {
      const before = existing?.images[lang]?.[kind]
      if (before === null || before?.manual) kept[kind] = before
      // TMDb not asked: the automatic pictures from before stay.
      else if (!tmdb && before) kept[kind] = before
      else if (auto[lang]?.[kind]) kept[kind] = before?.src === auto[lang][kind] ? before : { src: auto[lang][kind], at: Date.now() }
    }
    if (Object.keys(kept).length) images[lang] = kept
  }
  return {
    label: existing?.labelManual ? existing.label : detectLanguage(jellyfinText),
    ...(existing?.labelManual ? { labelManual: true } : {}),
    // Not asked (no key): what TMDb said before stays.
    tmdb: tmdb ?? existing?.tmdb ?? {},
    ...(tmdb ? { tmdbAt: Date.now() } : existing?.tmdbAt ? { tmdbAt: existing.tmdbAt } : {}),
    edited: existing?.edited ?? {},
    images,
  }
}

/** Done entries whose Jellyfin text now reads as another language (it changed, or the detection did) get the new label. */
function relabel(items: VideoItem[], existing: Record<string, Localized>, deps: LanguageDeps) {
  for (const item of items) {
    const entry = existing[item.Id]
    if (!entry || entry.labelManual) continue
    const label = detectLanguage(item.Overview)
    if (label !== entry.label) deps.put(item.Id, { ...entry, label }, metaOf(item))
  }
}

/** Whether an entry still needs doing: there is none, or TMDb wasn't asked for it and now can be. */
const needed = (entry: Localized | undefined, deps: LanguageDeps) => !entry || (deps.canTmdb && !entry.tmdbAt)

/** Both languages of a TMDb entry (a film, series or season), in one go. */
async function bothLanguages(deps: LanguageDeps, path: string) {
  const [de, en] = await Promise.all(LANGS.map((lang) => deps.tmdb(path, { language: TMDB_LANGUAGE[lang] })))
  return { de, en } as Record<Lang, unknown>
}

const metaOf = (item: VideoItem): LocalizedMeta => ({
  name: item.Name ?? '',
  type: item.Type ?? '',
  series: item.SeriesName,
  year: item.ProductionYear,
  season: item.Type === 'Episode' ? item.ParentIndexNumber : item.Type === 'Season' ? item.IndexNumber : undefined,
  episode: item.Type === 'Episode' ? item.IndexNumber : undefined,
})

/**
 * Fills in a film, or a series with its seasons and episodes, in both languages (without a TMDb key, only labels
 * their texts). With `onlyMissing`, a title whose entries are all done is left alone (returns null). Otherwise whether
 * TMDb had texts for it.
 */
export async function localizeTitle(title: VideoItem, deps: LanguageDeps, onlyMissing: boolean): Promise<boolean | null> {
  const tmdbId = title.ProviderIds?.Tmdb ?? title.ProviderIds?.tmdb
  // Without a TMDb id, TMDb has nothing to say ({}); without a key it wasn't asked (null).
  const unasked = deps.canTmdb ? {} : null
  if (title.Type === 'Movie') {
    const existing = deps.get([title.Id])[title.Id]
    if (onlyMissing && !needed(existing, deps)) {
      relabel([title], { [title.Id]: existing! }, deps)
      return null
    }
    if (!tmdbId || !deps.canTmdb) {
      deps.put(title.Id, merged(existing, title.Overview, unasked, {}), metaOf(title))
      return false
    }
    const [data, images] = await Promise.all([bothLanguages(deps, `movie/${tmdbId}`), deps.tmdb(`movie/${tmdbId}/images`, { include_image_language: LANGS.join(',') })])
    const tmdb = { de: texts(data.de, 'title'), en: texts(data.en, 'title') }
    deps.put(title.Id, merged(existing, title.Overview, tmdb, bestImages(images)), metaOf(title))
    return !!(tmdb.de.overview || tmdb.en.overview)
  }
  if (title.Type !== 'Series') return null

  const [seasons, episodes] = await Promise.all([
    deps.jellyfin<{ Items?: VideoItem[] }>(`/Shows/${title.Id}/Seasons`, { userId: '{user}', Fields: 'Overview,ProviderIds' }),
    deps.jellyfin<{ Items?: VideoItem[] }>(`/Shows/${title.Id}/Episodes`, { userId: '{user}', Fields: 'Overview,ProviderIds' }),
  ])
  const all = [title, ...(seasons.Items ?? []), ...(episodes.Items ?? [])]
  const existing = deps.get(all.map((item) => item.Id))
  if (onlyMissing && all.every((item) => !needed(existing[item.Id], deps))) {
    relabel(all, existing, deps)
    return null
  }
  if (!tmdbId || !deps.canTmdb) {
    for (const item of all) deps.put(item.Id, merged(existing[item.Id], item.Overview, unasked, {}), metaOf(item))
    return false
  }

  const [data, images] = await Promise.all([bothLanguages(deps, `tv/${tmdbId}`), deps.tmdb(`tv/${tmdbId}/images`, { include_image_language: LANGS.join(',') })])
  const seriesTexts = { de: texts(data.de, 'name'), en: texts(data.en, 'name') }
  deps.put(title.Id, merged(existing[title.Id], title.Overview, seriesTexts, bestImages(images)), metaOf(title))

  // A season's TMDb entry brings its episodes along: two calls per season.
  const numbers = [...new Set(all.flatMap((item) => (item.Type === 'Season' ? [item.IndexNumber] : item.Type === 'Episode' ? [item.ParentIndexNumber] : [])))]
  for (const number of numbers) {
    if (number === undefined || number === null) continue
    const season = await bothLanguages(deps, `tv/${tmdbId}/season/${number}`)
    const episodeTexts = (lang: Lang, index: number | undefined) =>
      texts(((season[lang] ?? {}) as { episodes?: Array<Record<string, unknown>> }).episodes?.find((entry) => entry.episode_number === index), 'name')
    for (const item of all) {
      if (item.Type === 'Season' && item.IndexNumber === number) {
        deps.put(item.Id, merged(existing[item.Id], item.Overview, { de: texts(season.de, 'name'), en: texts(season.en, 'name') }, {}), metaOf(item))
      } else if (item.Type === 'Episode' && item.ParentIndexNumber === number) {
        deps.put(item.Id, merged(existing[item.Id], item.Overview, { de: episodeTexts('de', item.IndexNumber), en: episodeTexts('en', item.IndexNumber) }, {}), metaOf(item))
      }
    }
  }
  // Episodes without a season number still get labelled.
  for (const item of all) {
    if (item.Type === 'Episode' && (item.ParentIndexNumber === undefined || item.ParentIndexNumber === null)) deps.put(item.Id, merged(existing[item.Id], item.Overview, {}, {}), metaOf(item))
  }
  return !!(seriesTexts.de.overview || seriesTexts.en.overview)
}
