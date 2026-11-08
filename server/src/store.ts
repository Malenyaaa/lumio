import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * What the Lumio server keeps (SQLite, one file): the people who used it (name and picture tag as Jellyfin reported
 * them, so others can see who they are), who follows whom, each person's privacy choices, what they last played, and
 * their Lumio settings that follow the account (the app decides which; the server keeps them as one JSON object),
 * and the credits looked up for the library's tracks (see credits.ts), shared by everyone.
 */
export interface Privacy {
  /** Others see the person's public playlists on their profile. */
  showPlaylists: boolean
  /** Others see whom the person follows. */
  showFollowing: boolean
  /** Others see who follows the person. */
  showFollowers: boolean
  /** Friends (people who follow each other) see what the person plays. */
  shareActivity: boolean
}

export const DEFAULT_PRIVACY: Privacy = { showPlaylists: true, showFollowing: true, showFollowers: true, shareActivity: true }

export interface Person {
  id: string
  name: string
  imageTag: string | null
}

export interface Activity {
  itemId: string
  name: string
  /** Artists (music) or the series (an episode). */
  subtitle?: string
  /** Album or season, with its id for a link. */
  context?: string
  contextId?: string
  kind: 'audio' | 'video'
  /** Still playing (false once paused or stopped). */
  playing: boolean
  /** When this was reported (ms). */
  at: number
}

export class Store {
  private db: DatabaseSync

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.db = new DatabaseSync(join(dataDir, 'lumio.sqlite'))
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, image_tag TEXT, privacy TEXT, seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS follows (follower TEXT NOT NULL, followee TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (follower, followee));
      CREATE INDEX IF NOT EXISTS follows_followee ON follows (followee);
      CREATE TABLE IF NOT EXISTS activity (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS track_credits (item_id TEXT PRIMARY KEY, data TEXT, at INTEGER NOT NULL);
    `)
    // What the track was (title, artist, album), so a list of misses can name them.
    const columns = this.db.prepare('PRAGMA table_info(track_credits)').all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === 'meta')) this.db.exec('ALTER TABLE track_credits ADD COLUMN meta TEXT')
  }

  /** Remembers who someone is (on every sign-in, so names and pictures stay current). */
  upsertPerson(person: Person) {
    this.db
      .prepare('INSERT INTO users (id, name, image_tag, seen) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, image_tag = excluded.image_tag, seen = excluded.seen')
      .run(person.id, person.name, person.imageTag, Date.now())
  }

  person(id: string): Person | null {
    const row = this.db.prepare('SELECT id, name, image_tag FROM users WHERE id = ?').get(id) as { id: string; name: string; image_tag: string | null } | undefined
    return row ? { id: row.id, name: row.name, imageTag: row.image_tag } : null
  }

  people(ids: string[]): Person[] {
    return ids.map((id) => this.person(id) ?? { id, name: '', imageTag: null })
  }

  privacy(id: string): Privacy {
    const row = this.db.prepare('SELECT privacy FROM users WHERE id = ?').get(id) as { privacy: string | null } | undefined
    return { ...DEFAULT_PRIVACY, ...(row?.privacy ? (JSON.parse(row.privacy) as Partial<Privacy>) : {}) }
  }

  setPrivacy(id: string, privacy: Partial<Privacy>) {
    const next = { ...this.privacy(id), ...privacy }
    this.db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(JSON.stringify(next), id)
    return next
  }

  follow(follower: string, followee: string) {
    if (follower === followee) return
    this.db.prepare('INSERT OR IGNORE INTO follows (follower, followee, at) VALUES (?, ?, ?)').run(follower, followee, Date.now())
  }

  unfollow(follower: string, followee: string) {
    this.db.prepare('DELETE FROM follows WHERE follower = ? AND followee = ?').run(follower, followee)
  }

  following(id: string): string[] {
    return (this.db.prepare('SELECT followee FROM follows WHERE follower = ? ORDER BY at DESC').all(id) as Array<{ followee: string }>).map((row) => row.followee)
  }

  followers(id: string): string[] {
    return (this.db.prepare('SELECT follower FROM follows WHERE followee = ? ORDER BY at DESC').all(id) as Array<{ follower: string }>).map((row) => row.follower)
  }

  follows(follower: string, followee: string) {
    return !!this.db.prepare('SELECT 1 FROM follows WHERE follower = ? AND followee = ?').get(follower, followee)
  }

  /** People who follow each other with `id`. */
  friends(id: string): string[] {
    return (
      this.db.prepare('SELECT a.followee AS id FROM follows a JOIN follows b ON b.follower = a.followee AND b.followee = a.follower WHERE a.follower = ?').all(id) as Array<{ id: string }>
    ).map((row) => row.id)
  }

  /** The person's account settings, and when they last changed (0: never saved). */
  settings(id: string): { data: Record<string, unknown>; updated: number } {
    const row = this.db.prepare('SELECT data, updated FROM settings WHERE user_id = ?').get(id) as { data: string; updated: number } | undefined
    return row ? { data: JSON.parse(row.data) as Record<string, unknown>, updated: row.updated } : { data: {}, updated: 0 }
  }

  /** Merges changed settings in (a null value removes one). */
  updateSettings(id: string, patch: Record<string, unknown>) {
    const data = this.settings(id).data
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete data[key]
      else data[key] = value
    }
    const updated = Date.now()
    this.db
      .prepare('INSERT INTO settings (user_id, data, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
      .run(id, JSON.stringify(data), updated)
    return { data, updated }
  }

  setActivity(id: string, activity: Activity) {
    this.db.prepare('INSERT INTO activity (user_id, payload) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload').run(id, JSON.stringify(activity))
  }

  activity(id: string): Activity | null {
    const row = this.db.prepare('SELECT payload FROM activity WHERE user_id = ?').get(id) as { payload: string } | undefined
    return row ? (JSON.parse(row.payload) as Activity) : null
  }

  clearActivity(id: string) {
    this.db.prepare('DELETE FROM activity WHERE user_id = ?').run(id)
  }

  /** The credits looked up for these tracks (null: looked up, none found); tracks never looked up are left out. */
  trackCredits(ids: string[]): Record<string, { data: unknown; at: number }> {
    const result: Record<string, { data: unknown; at: number }> = {}
    const query = this.db.prepare('SELECT data, at FROM track_credits WHERE item_id = ?')
    for (const id of ids) {
      const row = query.get(id) as { data: string | null; at: number } | undefined
      if (row) result[id] = { data: row.data ? (JSON.parse(row.data) as unknown) : null, at: row.at }
    }
    return result
  }

  setTrackCredits(id: string, data: unknown, meta: unknown) {
    this.db
      .prepare('INSERT INTO track_credits (item_id, data, at, meta) VALUES (?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET data = excluded.data, at = excluded.at, meta = excluded.meta')
      .run(id, data === null ? null : JSON.stringify(data), Date.now(), JSON.stringify(meta))
  }

  /** Looked-up tracks for browsing, newest first; `search` matches title, artist, album or anyone credited. */
  creditsPage(search: string, offset: number, limit: number): { total: number; rows: Array<{ id: string; at: number; data: unknown; meta: unknown }> } {
    const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
    const where = search ? "WHERE meta LIKE ? ESCAPE '\\' OR data LIKE ? ESCAPE '\\'" : ''
    const params = search ? [pattern, pattern] : []
    const { total } = this.db.prepare(`SELECT count(*) AS total FROM track_credits ${where}`).get(...params) as { total: number }
    const rows = this.db.prepare(`SELECT item_id, at, data, meta FROM track_credits ${where} ORDER BY at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Array<{
      item_id: string
      at: number
      data: string | null
      meta: string | null
    }>
    return {
      total,
      rows: rows.map((row) => ({ id: row.item_id, at: row.at, data: row.data ? (JSON.parse(row.data) as unknown) : null, meta: row.meta ? (JSON.parse(row.meta) as unknown) : null })),
    }
  }

  /** The tracks looked up without a result, most recent first. */
  tracksWithoutCredits(): Array<{ id: string; at: number; meta: unknown }> {
    const rows = this.db.prepare('SELECT item_id, at, meta FROM track_credits WHERE data IS NULL ORDER BY at DESC').all() as Array<{ item_id: string; at: number; meta: string | null }>
    return rows.map((row) => ({ id: row.item_id, at: row.at, meta: row.meta ? (JSON.parse(row.meta) as unknown) : null }))
  }
}
