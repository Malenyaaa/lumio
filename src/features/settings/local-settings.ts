import type { CSSProperties } from 'react'
import { useCallback, useSyncExternalStore } from 'react'
import { useAuthedSession, useSession } from '@/features/auth/session'

export type SegmentAction = 'None' | 'AskToSkip' | 'Skip'
export type SegmentKind = 'Intro' | 'Preview' | 'Recap' | 'Commercial' | 'Outro'

export type SubtitleSize = 'smaller' | 'small' | 'normal' | 'large' | 'larger' | 'extralarge'
export type SubtitleFont = 'default' | 'typewriter' | 'print' | 'console' | 'cursive' | 'casual' | 'smallcaps'
export type SubtitleShadow = 'none' | 'raised' | 'depressed' | 'uniform' | 'dropshadow'
/** SyncPlay timing, as in jellyfin-web's SyncPlay settings. Delays in milliseconds. */
export interface SyncPlaySettings {
  /** Keep correcting drift while playing in a group (otherwise only the group's commands align the players). */
  correction: boolean
  /** Small drift: play slightly faster/slower until caught up. */
  speedToSync: boolean
  speedMinDelay: number
  speedMaxDelay: number
  /** How long a speed correction runs. */
  speedDuration: number
  /** Large drift: jump to the right position. */
  skipToSync: boolean
  skipMinDelay: number
  /** Added to the measured server time, for devices whose output lags (Bluetooth audio, TVs). */
  extraOffset: number
}

export const DEFAULT_SYNCPLAY: SyncPlaySettings = {
  correction: true,
  speedToSync: true,
  speedMinDelay: 60,
  speedMaxDelay: 3000,
  speedDuration: 1000,
  skipToSync: true,
  skipMinDelay: 400,
  extraOffset: 0,
}

/** What the home screen is built from: the user's history, or Jellyfin's "latest per library". */
export type HomeLayout = 'personal' | 'jellyfin'
/** How the picture fills the screen: auto picks from the detected picture area, the rest are the CSS object-fit modes. */
export type VideoFit = 'auto' | 'contain' | 'cover' | 'fill'

/** Settings that belong to this device/browser (as in jellyfin-web); account-wide ones live in the Jellyfin user configuration. */
export interface LocalSettings {
  /** -1 = automatic */
  maxAudioChannels: number
  /** Default streaming limit in bit/s; null = automatic. */
  maxBitrate: number | null
  skipForwardSeconds: number
  skipBackSeconds: number
  segmentActions: Record<SegmentKind, SegmentAction>
  subtitleStyle: 'custom' | 'native'
  subtitleSize: SubtitleSize
  subtitleWeight: 'normal' | 'bold'
  subtitleFont: SubtitleFont
  subtitleColor: string
  subtitleShadow: SubtitleShadow
  /** Cue line as in WebVTT: 0 is the top line, -1 the bottom one (like jellyfin-web). */
  subtitleLine: number
  smoothScrolling: boolean
  keyboardShortcuts: boolean
  videoFit: VideoFit
  /** Speed new videos start at (1 = normal). */
  playbackRate: number
  /** When an intro is known and playback would start inside it, start right after it instead. */
  startAfterIntro: boolean
  /** Near the end of an episode, prepare the next one (stream info, segments, images) so it starts faster. */
  preloadNextEpisode: boolean
  /** Load all seek-preview thumbnails in the background once a video plays. */
  preloadTrickplay: boolean
  /** Show the preview card when resting the pointer on a card. */
  hoverPreview: boolean
  /** How long the pointer has to rest on a card before its preview appears. */
  hoverDelayMs: number
  /** Seconds without input before the player controls fade out. */
  controlsHideSeconds: number
  /** Show the title and description overlay on a paused video (0 = never). */
  pauseSpotlightSeconds: number
  /** Animate page changes. */
  pageAnimations: boolean
  /** Show the short notices in a corner ("Saved", "Added to queue"); off hides them all. */
  toasts: boolean
  homeLayout: HomeLayout
  syncPlay: SyncPlaySettings
  /** Which of the two apps this device shows; with one only, the switcher disappears. */
  apps: 'both' | 'watch' | 'listen'
  /** Highest music quality in kbps (above it the server converts to MP3); null = the original file where possible. */
  musicQuality: number | null
  /** How many of the next tracks are downloaded ahead into the cache while one plays (0 = none). */
  musicPrefetch: number
  /** Space the song cache may take, in MB. */
  musicCacheMb: number
  /** Songs played often stay in the cache rather than making room for new ones. */
  musicKeepOften: boolean
  /** When the queue runs out, keep playing similar music. */
  musicAutoplay: boolean
  /** How many of the next episodes of a series are downloaded while one plays (0 = none). */
  videoPrefetch: number
  /** Space the episode cache may take, in GB. */
  videoCacheGb: number
  /** Bitrate episodes are downloaded at, in Mbit/s. */
  videoBitrateMbit: number
  /** Where "concerts near you" are looked for (a city or the device's position); null = not set. */
  concertLocation: { label: string; lat: number; lon: number } | null
}

/**
 * Settings that follow the account: kept on the Lumio server and the same on every device the user signs in on (how
 * the player behaves, subtitles, skipping, where concerts are looked for …). Everything else belongs to the device:
 * quality and bandwidth, caches and preloading (they depend on its connection and storage), which apps it shows.
 */
export const ACCOUNT_SETTINGS = [
  'skipForwardSeconds',
  'skipBackSeconds',
  'segmentActions',
  'subtitleStyle',
  'subtitleSize',
  'subtitleWeight',
  'subtitleFont',
  'subtitleColor',
  'subtitleShadow',
  'subtitleLine',
  'keyboardShortcuts',
  'videoFit',
  'playbackRate',
  'startAfterIntro',
  'hoverPreview',
  'hoverDelayMs',
  'controlsHideSeconds',
  'pauseSpotlightSeconds',
  'pageAnimations',
  'toasts',
  'smoothScrolling',
  'homeLayout',
  'syncPlay',
  'musicAutoplay',
  'concertLocation',
] as const satisfies ReadonlyArray<keyof LocalSettings>

const ACCOUNT_KEYS = new Set<string>(ACCOUNT_SETTINGS)

/** The account's part of some settings. */
export function accountPart(settings: Partial<LocalSettings> | Record<string, unknown>): Partial<LocalSettings> {
  return Object.fromEntries(Object.entries(settings).filter(([key]) => ACCOUNT_KEYS.has(key))) as Partial<LocalSettings>
}

/** Sends account settings changed here to the server (set while connected, see account-sync). */
let accountUploader: { userId: string; send: (patch: Partial<LocalSettings>) => void } | null = null

export function setAccountUploader(next: typeof accountUploader) {
  accountUploader = next
}

export const DEFAULT_SETTINGS: LocalSettings = {
  maxAudioChannels: -1,
  maxBitrate: null,
  skipForwardSeconds: 30,
  skipBackSeconds: 10,
  segmentActions: { Intro: 'AskToSkip', Preview: 'None', Recap: 'None', Commercial: 'None', Outro: 'AskToSkip' },
  subtitleStyle: 'custom',
  subtitleSize: 'normal',
  subtitleWeight: 'normal',
  subtitleFont: 'default',
  subtitleColor: '#ffffff',
  subtitleShadow: 'dropshadow',
  subtitleLine: -3,
  smoothScrolling: false,
  keyboardShortcuts: true,
  videoFit: 'auto',
  playbackRate: 1,
  startAfterIntro: false,
  preloadNextEpisode: true,
  preloadTrickplay: true,
  hoverPreview: true,
  hoverDelayMs: 550,
  controlsHideSeconds: 3,
  pauseSpotlightSeconds: 10,
  pageAnimations: true,
  toasts: true,
  homeLayout: 'personal',
  syncPlay: DEFAULT_SYNCPLAY,
  apps: 'both',
  musicQuality: null,
  musicPrefetch: 2,
  musicCacheMb: 1024,
  musicKeepOften: true,
  musicAutoplay: true,
  videoPrefetch: 1,
  videoCacheGb: 5,
  videoBitrateMbit: 8,
  concertLocation: null,
}

const keyFor = (userId: string) => `lumio.settings.${userId}`
const listeners = new Set<() => void>()
/** Parsed settings per user, reused while the stored text is unchanged so React gets a stable snapshot. */
const cache = new Map<string, { raw: string | null; value: LocalSettings }>()
/** Fallback when localStorage is unavailable (private mode): settings then only last for this tab. */
const memory = new Map<string, string>()

function readRaw(userId: string): string | null {
  // A value only kept in memory means writing to localStorage failed (quota, private mode); it is newer than storage.
  if (memory.has(userId)) return memory.get(userId)!
  try {
    return localStorage.getItem(keyFor(userId))
  } catch {
    return null
  }
}

function parse(raw: string | null): LocalSettings {
  if (!raw) return DEFAULT_SETTINGS
  try {
    const stored = JSON.parse(raw) as Partial<LocalSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      segmentActions: { ...DEFAULT_SETTINGS.segmentActions, ...stored.segmentActions },
      syncPlay: { ...DEFAULT_SYNCPLAY, ...stored.syncPlay },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function read(userId: string): LocalSettings {
  const raw = readRaw(userId)
  const cached = cache.get(userId)
  if (cached && cached.raw === raw) return cached.value
  const value = parse(raw)
  cache.set(userId, { raw, value })
  return value
}

/** `fromAccount`: the change came from the server, so it isn't sent back there. */
function write(userId: string, patch: Partial<LocalSettings>, fromAccount = false) {
  const next = JSON.stringify({ ...read(userId), ...patch })
  try {
    localStorage.setItem(keyFor(userId), next)
    memory.delete(userId)
  } catch {
    memory.set(userId, next)
  }
  for (const listener of listeners) listener()
  if (!fromAccount && accountUploader?.userId === userId) {
    const shared = accountPart(patch)
    if (Object.keys(shared).length) accountUploader.send(shared)
  }
}

/** Takes over the account's settings from the server (on connecting, and when another device changes one). */
export function applyAccountSettings(userId: string, data: Record<string, unknown>) {
  const shared = accountPart(data)
  if (Object.keys(shared).length) write(userId, shared, true)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** The settings outside React (e.g. in timers of providers that also run while signed out). */
export function readLocalSettings(userId: string): LocalSettings {
  return read(userId)
}

/** Whether notices (toasts) show; while signed out, they do. */
export function useToastsWanted(): boolean {
  const userId = useSession().session?.userId
  return useSyncExternalStore(subscribe, () => (userId ? read(userId).toasts : true))
}

export function useLocalSettings() {
  const { session } = useAuthedSession()
  const userId = session.userId
  const settings = useSyncExternalStore(subscribe, () => read(userId))
  const update = useCallback((patch: Partial<LocalSettings>) => write(userId, patch), [userId])
  return { settings, update }
}

const SIZES: Record<SubtitleSize, string> = {
  smaller: '1rem',
  small: '1.25rem',
  normal: '1.5rem',
  large: '1.9rem',
  larger: '2.4rem',
  extralarge: '3rem',
}

const FONTS: Record<SubtitleFont, { family: string; variant: string }> = {
  default: { family: 'inherit', variant: 'normal' },
  typewriter: { family: '"Courier New", Courier, monospace', variant: 'normal' },
  print: { family: 'Georgia, "Times New Roman", serif', variant: 'normal' },
  console: { family: 'ui-monospace, Menlo, Consolas, monospace', variant: 'normal' },
  cursive: { family: '"Brush Script MT", "Segoe Script", cursive', variant: 'normal' },
  casual: { family: '"Comic Sans MS", "Chalkboard SE", casual', variant: 'normal' },
  smallcaps: { family: 'inherit', variant: 'small-caps' },
}

const SHADOWS: Record<SubtitleShadow, string> = {
  none: 'none',
  raised: '0 2px 3px #000',
  depressed: '0 -1px 0 #000',
  uniform: '0 0 4px #000, 0 0 4px #000, 0 0 4px #000',
  dropshadow: '2px 2px 3px #000',
}

/**
 * CSS custom properties that `video::cue` (see index.css) and the settings preview read.
 * "native" leaves them unset so the browser's own cue styling applies.
 */
export function subtitleCssVars(settings: LocalSettings): CSSProperties {
  if (settings.subtitleStyle === 'native') return {}
  const font = FONTS[settings.subtitleFont]
  return {
    '--sub-size': SIZES[settings.subtitleSize],
    '--sub-weight': settings.subtitleWeight === 'bold' ? 700 : 400,
    '--sub-family': font.family,
    '--sub-variant': font.variant,
    '--sub-color': settings.subtitleColor,
    '--sub-shadow': SHADOWS[settings.subtitleShadow],
  } as CSSProperties
}
