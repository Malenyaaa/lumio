/**
 * A track's full credits from MusicBrainz: everyone on the recording (Jellyfin knows only what the file's tags say,
 * which often leaves out featured artists), who wrote, produced and mixed it, its label, publisher and ISRC. Looked up
 * once per track and kept for everyone (see Store.trackCredits); the lookups go through the cached relay, which keeps
 * to MusicBrainz's one call a second.
 */

export interface TrackCredits {
  /** The MusicBrainz recording. */
  recording: string
  artists: string[]
  writers: string[]
  composers: string[]
  lyricists: string[]
  producers: string[]
  mixers: string[]
  engineers: string[]
  publishers: string[]
  labels: string[]
  isrc?: string
}

/** What is known of a track in Jellyfin, enough to find its recording. */
export interface TrackMeta {
  title: string
  artist: string
  album?: string
  /** Length in seconds. */
  seconds?: number
  /** The album in Jellyfin, to link to it from lists. */
  albumId?: string
}

/** A MusicBrainz call (path and query, without fmt); null when it failed. */
export type MusicBrainz = (path: string, query: Record<string, string>) => Promise<unknown>

interface Relation {
  type: string
  artist?: { name: string }
  label?: { name: string }
  work?: { relations?: Relation[] }
}

/** The same name, ignoring case, accents, punctuation and "(feat. …)"-style additions. */
export function sameName(a: string | null | undefined, b: string | null | undefined) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s*[([].*?(feat|ft|with|remaster|version|edit).*?[)\]]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '')
  return !!a && !!b && normalize(a) === normalize(b)
}

/** The recording with the same title and artist, closest in length, and its credits; null when there is none. */
export async function lookupCredits(meta: TrackMeta, musicbrainz: MusicBrainz): Promise<TrackCredits | null> {
  const quote = (value: string) => `"${value.replace(/["\\]/g, ' ')}"`
  // "Song (feat. Someone)": MusicBrainz names the song without the guests (they are in its artist credit).
  const bare = meta.title.replace(/\s*[([](feat|ft|with)\.?\s[^)\]]*[)\]]/gi, '').trim() || meta.title
  const found = (await musicbrainz('recording', { query: `recording:${quote(bare)} AND artist:${quote(meta.artist)}`, limit: '10' })) as {
    recordings?: Array<{ id: string; score: number; title: string; length?: number; 'artist-credit'?: Array<{ name: string; artist?: { name: string } }> }>
  } | null
  const off = (length?: number) => (meta.seconds && length ? Math.abs(length / 1000 - meta.seconds) : 30)
  const best = (found?.recordings ?? [])
    .filter(
      (recording) =>
        recording.score >= 90 &&
        sameName(recording.title, meta.title) &&
        recording['artist-credit']?.some((credit) => sameName(credit.name, meta.artist) || sameName(credit.artist?.name, meta.artist)),
    )
    .sort((a, b) => off(a.length) - off(b.length))[0]
  if (!best || off(best.length) > 15) return null
  return creditsOfRecording(best.id, meta.album, musicbrainz)
}

/** The candidates for a track on MusicBrainz, for an admin to pick from when the automatic match found none. */
export async function searchRecordings(title: string, artist: string, musicbrainz: MusicBrainz) {
  const quote = (value: string) => `"${value.replace(/["\\]/g, ' ')}"`
  const query = [title && `recording:${quote(title)}`, artist && `artist:${quote(artist)}`].filter(Boolean).join(' AND ')
  const found = (await musicbrainz('recording', { query, limit: '15' })) as {
    recordings?: Array<{ id: string; score: number; title: string; length?: number; 'artist-credit'?: Array<{ name: string; joinphrase?: string }>; releases?: Array<{ title: string; date?: string }> }>
  } | null
  return (found?.recordings ?? []).map((recording) => ({
    id: recording.id,
    score: recording.score,
    title: recording.title,
    artist: (recording['artist-credit'] ?? []).map((credit) => credit.name + (credit.joinphrase ?? '')).join(''),
    seconds: recording.length ? Math.round(recording.length / 1000) : undefined,
    release: recording.releases?.[0]?.title,
    year: recording.releases?.[0]?.date?.slice(0, 4),
  }))
}

/** A recording's credits by its MusicBrainz id (the album names the release to take the label from). */
export async function creditsOfRecording(id: string, album: string | undefined, musicbrainz: MusicBrainz): Promise<TrackCredits | null> {
  const recording = (await musicbrainz(`recording/${id}`, { inc: 'artist-credits+artist-rels+label-rels+work-rels+work-level-rels+releases+isrcs' })) as {
    'artist-credit'?: Array<{ name: string; artist?: { name: string } }>
    relations?: Relation[]
    releases?: Array<{ id: string; title: string; status?: string }>
    isrcs?: string[]
  } | null
  if (!recording) return null

  const credits: TrackCredits = {
    recording: id,
    artists: [],
    writers: [],
    composers: [],
    lyricists: [],
    producers: [],
    mixers: [],
    engineers: [],
    publishers: [],
    labels: [],
    isrc: recording.isrcs?.[0],
  }
  const add = (list: string[], name?: string) => {
    if (name && !list.includes(name)) list.push(name)
  }
  const lists: Record<string, string[]> = {
    writer: credits.writers,
    composer: credits.composers,
    lyricist: credits.lyricists,
    producer: credits.producers,
    mix: credits.mixers,
    engineer: credits.engineers,
    mastering: credits.engineers,
    recording: credits.engineers,
  }
  const read = (relations: Relation[] = []) => {
    for (const relation of relations) {
      if (lists[relation.type]) add(lists[relation.type]!, relation.artist?.name)
      else if (relation.type === 'publishing') add(credits.publishers, relation.label?.name)
      if (relation.work) read(relation.work.relations)
    }
  }
  read(recording.relations)
  for (const credit of recording['artist-credit'] ?? []) add(credits.artists, credit.artist?.name ?? credit.name)

  // The label: from the release this track is on (the album of that name), else its first official one.
  const releases = recording.releases ?? []
  const release = releases.find((entry) => sameName(entry.title, album)) ?? releases.find((entry) => entry.status === 'Official') ?? releases[0]
  if (release) {
    const details = (await musicbrainz(`release/${release.id}`, { inc: 'labels' }).catch(() => null)) as { 'label-info'?: Array<{ label?: { name: string } }> } | null
    for (const info of details?.['label-info'] ?? []) if (info.label?.name !== '[no label]') add(credits.labels, info.label?.name)
  }
  return credits
}

/** An entry a task couldn't finish (a service didn't answer), to be tried again on the next run. */
export interface Failure {
  id: string
  title: string
  artist?: string
  album?: string
  albumId?: string
  error: string
}

/** Where one of the administrators' library tasks stands. */
export interface JobState {
  running: boolean
  total: number
  done: number
  found: number
  failed: number
  startedAt?: number
  finishedAt?: number
  error?: string
  failures: Failure[]
}
