import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models'
import { getLocale, LOCALES, messagesFor, type Locale } from '@/lib/i18n'
import { qualifierLabels, trackLabelMessages } from '@/lib/messages'

/**
 * Readable names for video, audio and subtitle tracks:
 *
 *   5.1 AC3 @ 640 kbps - German - Dolby Digital - Std.  ->  Deutsch · Dolby Digital 5.1
 *   Commentary - German - DVDSUB                        ->  Deutsch · Commentary · Bild
 *   German Forced - Standard - Erzwungen - SUBRIP       ->  Deutsch · Forced
 *   1920x816 H264 SDR                                   ->  Full HD (1080p)
 *
 * Labels come from the structured stream fields. A free-text stream title is only kept when it says something the
 * fields don't ("Commentary", "SDH", ...); release-group and file-name noise is dropped. Labels are in the app's current
 * language (language names via Intl), computed when called.
 */

const SEPARATOR = ' · '

/** Jellyfin's three-letter codes (including the bibliographic variants like "ger") as the two-letter ones Intl names. */
const LANGUAGE_CODES: Record<string, string> = {
  deu: 'de', ger: 'de', eng: 'en', fra: 'fr', fre: 'fr', spa: 'es', ita: 'it', nld: 'nl', dut: 'nl', por: 'pt',
  pol: 'pl', rus: 'ru', tur: 'tr', jpn: 'ja', kor: 'ko', zho: 'zh', chi: 'zh', ara: 'ar', ces: 'cs', cze: 'cs',
  dan: 'da', fin: 'fi', swe: 'sv', nor: 'no', nob: 'no', hun: 'hu', ell: 'el', gre: 'el', heb: 'he', hin: 'hi',
  tha: 'th', ukr: 'uk', ron: 'ro', rum: 'ro', bul: 'bg', hrv: 'hr', srp: 'sr', slk: 'sk', slo: 'sk', slv: 'sl',
  vie: 'vi', ind: 'id', msa: 'ms', cat: 'ca',
}

/** English names, so a stream title that merely repeats the language can be recognised as redundant. */
const ENGLISH_NAMES: Record<string, string> = {
  deu: 'german', ger: 'german', eng: 'english', fra: 'french', fre: 'french', spa: 'spanish', ita: 'italian',
  nld: 'dutch', dut: 'dutch', por: 'portuguese', pol: 'polish', rus: 'russian', tur: 'turkish', jpn: 'japanese',
  kor: 'korean', zho: 'chinese', chi: 'chinese', ara: 'arabic', ces: 'czech', cze: 'czech', dan: 'danish',
  fin: 'finnish', swe: 'swedish', nor: 'norwegian', nob: 'norwegian', hun: 'hungarian', ell: 'greek', gre: 'greek',
  heb: 'hebrew', hin: 'hindi', tha: 'thai', ukr: 'ukrainian', ron: 'romanian', rum: 'romanian', bul: 'bulgarian',
  hrv: 'croatian', srp: 'serbian', slk: 'slovak', slo: 'slovak', slv: 'slovenian', vie: 'vietnamese', ind: 'indonesian',
  msa: 'malay', cat: 'catalan',
}

/** Whole-word match that also works for words with umlauts and accents (`\b` treats "é" as a word boundary). */
const word = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives})(?![\\p{L}\\p{N}])`, 'iu')

const MARKERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: word('commentary|kommentar(e|spur)?|audiokommentar'), label: 'Commentary' },
  { pattern: word('forced|erzwungen|forcé'), label: 'Forced' },
  { pattern: word('sdh|cc|hearing[\\s-]?impaired|hörgeschädigt|gehörlose'), label: 'SDH' },
  { pattern: word('karaoke|songs?|lyrics|signs?'), label: 'Signs & Songs' },
]

/** Titles that only say "this is the normal track"; a track without a Forced marker already is the full one. */
const REDUNDANT = /^(komplett|kompletto?|complete|full|voll|vollständig|standard|default|normal|main|haupt|regular|dialogue|dialog)$/i

/** Titles that restate technical data or are a release/file name. */
const NOISE: RegExp[] = [
  /^\s*\d+(\.\d+)?\s*(k|m)?bps\b/i,
  /\b(avc|hevc|h\.?26[45]|mpeg-?[24]|xvid|divx|vp9|av1)\b/i,
  /\b(ac3|eac3|dts|aac|flac|truehd|opus|mp3)\b/i,
  /\b\d\.\d\b/,
  /\b(4k|2160p|1080[pi]|720p|576[pi]|480[pi])\b/i,
  /\b(bluray|blu-ray|bdrip|brrip|web-?dl|webrip|hdtv|dvdrip|remux)\b/i,
  /-(?:[a-z0-9]+)$/i,
  /^[a-z0-9]+(?:[.\-_][a-z0-9]+){3,}$/i,
]

/** Subtitle format names that show up in stream titles next to the language. */
const FORMAT_WORDS = /^(srt|pgs|pgssub|ass|ssa|sub|subrip|vobsub|dvdsub|vtt|webvtt|text)$/i

/** Pre-rendered image subtitles: they can't follow the user's styling and may force the server to transcode. */
const BITMAP_SUBTITLES = /^(dvdsub|dvd_subtitle|vobsub|pgssub|pgs|hdmv_pgs_subtitle|dvbsub|dvb_subtitle|xsub)$/i

const displayNames = new Map<Locale, Intl.DisplayNames>()
const namesIn = (locale: Locale) => {
  let names = displayNames.get(locale)
  if (!names) displayNames.set(locale, (names = new Intl.DisplayNames([locale], { type: 'language' })))
  return names
}

function intlName(names: Intl.DisplayNames, code: string) {
  try {
    const name = names.of(code)
    return name && name.toLowerCase() !== code ? name : ''
  } catch {
    return '' // Intl doesn't know the code
  }
}

/** One key per language, whatever code a file uses for it ("ger", "deu" and "de" are all "de"). */
export function languageKey(code?: string | null): string {
  const key = (code ?? '').toLowerCase()
  return LANGUAGE_CODES[key] ?? key
}

/** "ger" -> "Deutsch" / "German", in the app's language unless another is asked for. */
export function languageName(code?: string | null, locale: Locale = getLocale()): string {
  if (!code) return ''
  const key = code.toLowerCase()
  if (key === 'und') return ''
  if (key === 'mul') return trackLabelMessages[locale].multipleLanguages
  return intlName(namesIn(locale), LANGUAGE_CODES[key] ?? key) || key.toUpperCase()
}

function englishName(code?: string | null) {
  const key = (code ?? '').toLowerCase()
  return ENGLISH_NAMES[key] ?? intlName(namesIn('en'), LANGUAGE_CODES[key] ?? key).toLowerCase()
}

const RESOLUTIONS = ['SD (480p)', 'SD (576p)', 'HD (720p)', 'Full HD (1080p)', 'QHD (1440p)', 'UHD 4K (2160p)', 'UHD 8K (4320p)']
const WIDTH_STEPS = [900, 1200, 1700, 2400, 3400, 7000]
const HEIGHT_STEPS = [540, 650, 1000, 1300, 2000, 4000]
const step = (value: number, steps: number[]) => steps.filter((threshold) => value >= threshold).length

/**
 * Resolution class from whichever dimension says more: letterboxed scope prints are shorter than their class
 * (1920x816 is 1080p), 4:3 and pillarboxed ones narrower (1440x1080 is 1080p too).
 */
export function resolutionName(stream: MediaStream): string {
  const width = stream.Width ?? 0
  const height = stream.Height ?? 0
  if (!width && !height) return ''
  return RESOLUTIONS[Math.max(step(width, WIDTH_STEPS), step(height, HEIGHT_STEPS))]!
}

function audioFormat(stream: MediaStream): string {
  const codec = (stream.Codec ?? '').toLowerCase()
  const profile = stream.Profile ?? ''
  if (/atmos/i.test(profile)) return 'Dolby Atmos'
  if (/dts[-\s]?x/i.test(profile)) return 'DTS:X'
  switch (codec) {
    case 'truehd': return 'Dolby TrueHD'
    case 'eac3': return 'Dolby Digital Plus'
    case 'ac3': return 'Dolby Digital'
    case 'dts':
      if (/ma\b|master/i.test(profile)) return 'DTS-HD MA'
      if (/hra|high.?res/i.test(profile)) return 'DTS-HD HR'
      return 'DTS'
    case 'aac': return 'AAC'
    case 'flac': return 'FLAC'
    case 'opus': return 'Opus'
    case 'vorbis': return 'Vorbis'
    case 'mp3': return 'MP3'
    case 'mp2': return 'MP2'
    case 'pcm':
    case 'pcm_s16le':
    case 'pcm_s24le': return 'PCM'
    default: return codec ? codec.toUpperCase() : ''
  }
}

function channelName(stream: MediaStream): string {
  const layout = (stream.ChannelLayout ?? '').toLowerCase()
  if (layout === 'mono') return '1.0'
  if (layout === 'stereo') return '2.0'
  if (/^\d(\.\d)?$/.test(layout)) return layout
  switch (stream.Channels ?? 0) {
    case 0: return ''
    case 1: return '1.0'
    case 2: return '2.0'
    case 6: return '5.1'
    case 8: return '7.1'
    default: return `${stream.Channels}ch`
  }
}

/** Flags worth showing: from the stream's own fields and from marker words in its title. */
function markersFrom(stream: MediaStream): string[] {
  const found: string[] = []
  // Jellyfin also reports IsForced on default audio tracks, where it means "default", not "forced".
  if (stream.IsForced && stream.Type === 'Subtitle') found.push('Forced')
  const title = stream.Title ?? ''
  for (const { pattern, label } of MARKERS) {
    if (pattern.test(title) && !found.includes(label)) found.push(label)
  }
  return found
}

/** "European Spanish" -> "Europa" / "Europe", "Dutch" -> "" (pure repetition), null when the title doesn't mention the language. */
function regionalQualifier(stream: MediaStream): string | null {
  const title = (stream.Title ?? '').trim().toLowerCase()
  const name = englishName(stream.Language)
  if (!title || !name || !title.includes(name)) return null
  const rest = title.replace(name, '').replace(/[()\-,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!rest) return ''
  if (MARKERS.some(({ pattern }) => pattern.test(rest))) return ''
  // "English (SRT)", "English Dolby TrueHD 5.1": what's left is a format or codec, not a region.
  if (FORMAT_WORDS.test(rest) || NOISE.some((pattern) => pattern.test(rest))) return ''
  const qualifiers: Record<string, string> = messagesFor(qualifierLabels)
  return qualifiers[rest] ?? rest.charAt(0).toUpperCase() + rest.slice(1)
}

/** A title survives as free text only if it adds information and doesn't look like a release name. */
function meaningfulTitle(stream: MediaStream): string {
  const title = (stream.Title ?? '').trim()
  if (!title || title.length > 40) return ''
  if (REDUNDANT.test(title)) return ''
  if (MARKERS.some(({ pattern }) => pattern.test(title))) return ''
  if (NOISE.some((pattern) => pattern.test(title))) return ''
  if (regionalQualifier(stream) !== null) return ''
  // "Deutsch", "Deutsch (SRT)": the title only repeats the language (named in any of the app's languages), optionally
  // with the subtitle format.
  for (const locale of LOCALES) {
    const language = languageName(stream.Language, locale)
    if (!language) continue
    const rest = title.toLowerCase().replace(language.toLowerCase(), '').replace(/[()\-,]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!rest || FORMAT_WORDS.test(rest)) return ''
  }
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/** "Spanisch (Europa)" rather than "Spanisch · Europa". */
function languagePart(stream: MediaStream): string {
  const name = languageName(stream.Language)
  const qualifier = regionalQualifier(stream)
  if (!name) return qualifier ?? ''
  return qualifier ? `${name} (${qualifier})` : name
}

const join = (parts: Array<string | undefined>) => parts.filter(Boolean).join(SEPARATOR)

export function videoLabel(stream: MediaStream): string {
  return resolutionName(stream) || messagesFor(trackLabelMessages).video
}

export function audioLabel(stream: MediaStream): string {
  const format = audioFormat(stream)
  const channels = channelName(stream)
  const spec = format && channels ? `${format} ${channels}` : format || channels
  return join([languagePart(stream), meaningfulTitle(stream), ...markersFrom(stream), spec]) || messagesFor(trackLabelMessages).audio
}

export function subtitleLabel(stream: MediaStream): string {
  const t = messagesFor(trackLabelMessages)
  const bitmap = BITMAP_SUBTITLES.test(stream.Codec ?? '') ? t.bitmap : ''
  return join([languagePart(stream), meaningfulTitle(stream), ...markersFrom(stream), bitmap]) || t.subtitle
}

/**
 * Labels for a list of streams, with tracks that end up identical collapsed (some releases carry dozens of subtitle
 * streams of the same language and format). Streams listed in `keep` are never dropped, so a selected track stays.
 */
export function labelStreams(streams: MediaStream[], label: (stream: MediaStream) => string, keep: Array<number | null | undefined> = []) {
  const seen = new Set<string>()
  const result: Array<{ index: number; label: string }> = []
  for (const stream of streams) {
    if (stream.Index == null) continue
    const text = label(stream)
    if (seen.has(text) && !keep.includes(stream.Index)) continue
    seen.add(text)
    result.push({ index: stream.Index, label: text })
  }
  return result
}
