import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { lumioSend } from '@/features/social/social'
import { externalOf } from '@/lib/external-items'
import { browserName } from '@/lib/jellyfin'

/**
 * Lumio's own play log, kept on the Lumio server: one session per track played.
 * - Podcast episodes: how long they were listened to (Jellyfin never sees them, so its Playback Reporting can't count
 *   them).
 * - Songs: Jellyfin counts the play itself; Lumio keeps how it went, as Spotify does: why it started and why it ended
 *   (played to the end, skipped, …), where it was played from (album, playlist, the user's queue, autoplay), whether
 *   shuffle was on, whether it came from the device, and how long it buffered.
 * Only time actually playing counts. What can't be sent (offline) is kept and sent later.
 */
export type StartReason = 'clickrow' | 'playbtn' | 'fwdbtn' | 'backbtn' | 'trackdone' | 'trackerror' | 'remote' | 'appload'
export type EndReason = 'trackdone' | 'fwdbtn' | 'backbtn' | 'clickrow' | 'playbtn' | 'remote' | 'trackerror' | 'endplay' | 'logout'

/** How a track came to play, told by the player when it starts. */
export interface PlayContext {
  reasonStart: StartReason
  /** `album:<id>`, `playlist:<id>`, `official:<slug>`, `liked`, `queue` (the user's), `autoplay` … */
  source?: string
  shuffle: boolean
  offline: boolean
}

interface Session {
  session: string
  kind: 'podcast' | 'audio' | 'video'
  key: string
  title: string
  subtitle?: string
  contextId?: string
  image?: string
  client: string
  startedAt: number
  seconds: number
  source?: string
  reasonStart?: StartReason
  reasonEnd?: EndReason
  shuffle?: boolean
  offline?: boolean
  bufferingMs: number
  /** A song's main artist and album (for Wrapped). */
  artist?: string
  album?: string
}

const PENDING_KEY = 'lumio.plays.pending'
/** While playing, the seconds go out at most this often. */
const SEND_EVERY_MS = 60_000
/** A gap longer than this between two reports (a sleeping laptop) doesn't count as listening. */
const MAX_STEP_MS = 30_000

let current: Session | null = null
let lastTick = 0
let lastSent = 0
/** Whether it was playing at the last report: the time since then counts only if so. */
let wasPlaying = false
/** When the current wait for data began (0: not waiting). */
let bufferingSince = 0

function readPending(): Record<string, Session> {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}') as Record<string, Session>
  } catch {
    return {}
  }
}

function writePending(pending: Record<string, Session>) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // Kept for this visit only.
  }
}

/** Sends a session (and whatever couldn't be sent before); kept for later when the server can't be reached. */
async function send(session: Session) {
  const pending = { ...readPending(), [session.session]: session }
  writePending(pending)
  for (const entry of Object.values(pending)) {
    const response = await lumioSend('POST', '/me/plays', entry).catch(() => null)
    if (!response?.ok) return
    const left = readPending()
    // Only done when nothing newer was kept for it meanwhile.
    if (left[entry.session]?.seconds === entry.seconds && left[entry.session]?.reasonEnd === entry.reasonEnd) delete left[entry.session]
    writePending(left)
  }
}

function snapshot(session: Session): Session {
  const waiting = bufferingSince ? Date.now() - bufferingSince : 0
  return { ...session, seconds: Math.round(session.seconds), bufferingMs: Math.round(session.bufferingMs + waiting) }
}

/**
 * Called with the player's reports. `start` opens a session (with `context`: how the track came to play), `progress`
 * counts the time since the last report (if it was playing) and sends it now and then, `stopped` sends it at once
 * with `reasonEnd`.
 */
export function logPlay(
  kind: 'start' | 'progress' | 'stopped',
  item: BaseItemDto,
  playing: boolean,
  sessionId: string,
  details: { context?: PlayContext; reasonEnd?: EndReason } = {},
) {
  const external = externalOf(item)
  if (!external && !item.Id) return
  const now = Date.now()
  if (kind === 'start' || !current || current.session !== sessionId) {
    // A session that wasn't stopped yet (it shouldn't happen) is sent as it is.
    if (current && current.session !== sessionId && current.seconds > 0) void send(snapshot(current))
    current = {
      session: sessionId,
      kind: external ? 'podcast' : 'audio',
      key: external ? external.guid : item.Id!,
      title: item.Name ?? '',
      subtitle: external ? (item.Album ?? item.AlbumArtist ?? undefined) : (item.Artists?.join(', ') || item.AlbumArtist || undefined),
      contextId: external ? external.podcastId : (item.AlbumId ?? undefined),
      image: external?.image,
      client: `Lumio · ${browserName()}`,
      startedAt: now,
      seconds: 0,
      source: details.context?.source,
      reasonStart: details.context?.reasonStart,
      shuffle: details.context?.shuffle,
      offline: details.context?.offline,
      bufferingMs: 0,
      artist: external ? undefined : (item.Artists?.[0] ?? item.AlbumArtist ?? undefined),
      album: external ? undefined : (item.Album ?? undefined),
    }
    bufferingSince = 0
    lastTick = now
    lastSent = now
    wasPlaying = playing
    return
  }
  if (wasPlaying) current.seconds += Math.min(now - lastTick, MAX_STEP_MS) / 1000
  lastTick = now
  wasPlaying = playing
  if (kind === 'stopped') {
    current.reasonEnd = details.reasonEnd ?? 'endplay'
    const session = snapshot(current)
    current = null
    bufferingSince = 0
    // A song touched for less than a second isn't a play worth keeping.
    if (session.seconds > 0 || session.kind === 'audio') void send(session)
    return
  }
  if (now - lastSent >= SEND_EVERY_MS) {
    lastSent = now
    const session = snapshot(current)
    if (session.seconds > 0) void send(session)
  }
}

/** The player waits for data (buffering) or has it again: counted for the current session. */
export function logBuffering(waiting: boolean) {
  if (!current) return
  if (waiting && !bufferingSince) bufferingSince = Date.now()
  else if (!waiting && bufferingSince) {
    current.bufferingMs += Date.now() - bufferingSince
    bufferingSince = 0
  }
}

/**
 * A film or episode watched without a connection (its stop couldn't be reported to Jellyfin, so Playback Reporting
 * never saw it): kept and handed in to the Lumio server once back, where the statistics count it. Named as Playback
 * Reporting names it ("Series - s01e02 - Title").
 */
export function logOfflineWatch(item: BaseItemDto, startedAt: number, seconds: number, sessionId: string) {
  if (!item.Id || seconds < 1) return
  const pad = (value?: number | null) => String(value ?? 0).padStart(2, '0')
  const title = item.Type === 'Episode' ? `${item.SeriesName ?? ''} - s${pad(item.ParentIndexNumber)}e${pad(item.IndexNumber)} - ${item.Name ?? ''}` : (item.Name ?? '')
  void send({
    session: sessionId,
    kind: 'video',
    key: item.Id,
    title,
    subtitle: item.Type ?? undefined,
    contextId: item.SeriesId ?? undefined,
    client: `Lumio · ${browserName()}`,
    startedAt,
    seconds: Math.round(seconds),
    offline: true,
    bufferingMs: 0,
  })
}

/** Sends what was kept while offline (called when the connection to the Lumio server is there). */
export function flushPlays() {
  const pending = Object.values(readPending())
  if (pending[0]) void send(pending[0])
}

// Back online: what was kept goes out.
if (typeof window !== 'undefined') window.addEventListener('online', () => flushPlays())
