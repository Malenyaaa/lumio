import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { lumioSend } from '@/features/social/social'
import { externalOf } from '@/lib/external-items'
import { browserName } from '@/lib/jellyfin'

/**
 * Counts how long podcast episodes are listened to and tells the Lumio server, which keeps it with everyone's plays
 * (Jellyfin never sees podcasts: Lumio plays them from their hosts, so its Playback Reporting can't count them). One
 * listening session per episode played; only time actually playing counts. What can't be sent (offline) is kept and
 * sent later.
 */
interface Session {
  session: string
  key: string
  title: string
  subtitle?: string
  contextId?: string
  image?: string
  client: string
  startedAt: number
  seconds: number
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
    if (left[entry.session]?.seconds === entry.seconds) delete left[entry.session]
    writePending(left)
  }
}

/**
 * Called with the player's reports: `start` opens a session for a podcast episode, `progress` and `stopped` count the
 * time since the last report (if it was playing) and send it now and then, or at once when it stops.
 */
export function logPodcastPlay(kind: 'start' | 'progress' | 'stopped', item: BaseItemDto, playing: boolean, sessionId: string) {
  const external = externalOf(item)
  if (!external) return
  const now = Date.now()
  if (kind === 'start' || !current || current.session !== sessionId) {
    current = {
      session: sessionId,
      key: external.guid,
      title: item.Name ?? '',
      subtitle: item.Album ?? item.AlbumArtist ?? undefined,
      contextId: external.podcastId,
      image: external.image,
      client: `Lumio · ${browserName()}`,
      startedAt: now,
      seconds: 0,
    }
    lastTick = now
    lastSent = now
    wasPlaying = playing
    return
  }
  const step = now - lastTick
  if (wasPlaying) current.seconds += Math.min(step, MAX_STEP_MS) / 1000
  lastTick = now
  wasPlaying = playing
  if (kind === 'stopped' || now - lastSent >= SEND_EVERY_MS) {
    lastSent = now
    const session = { ...current, seconds: Math.round(current.seconds) }
    if (session.seconds > 0) void send(session)
    if (kind === 'stopped') current = null
  }
}

/** Sends what was kept while offline (called when the connection to the Lumio server is there). */
export function flushPodcastPlays() {
  const pending = Object.values(readPending())
  if (pending[0]) void send(pending[0])
}
