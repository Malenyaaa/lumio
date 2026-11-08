/**
 * Jellyfin's official Android app, which shows the server's web client (here Lumio) in a WebView. It adds
 * `window.NativeInterface` before the page loads; its own screens (app settings, server and account selection), the
 * media notification, fullscreen and leaving the app are reached through it.
 *
 * The other way round, the app only ever runs fixed snippets of jellyfin-web's: the hardware back button calls
 * `window.NavigationHelper.goBack()`, and the buttons of the media notification (lock screen, headset, Bluetooth)
 * call `window.NavigationHelper.playbackManager.<command>()`. Lumio provides that object (`NavigationHelper` below).
 */
interface NativeInterface {
  openClientSettings(): void
  openServerSelection(): void
  enableFullscreen(): boolean
  disableFullscreen(): boolean
  /** A JSON string; see `AppMediaSession`. Shows or updates the media notification (a foreground service). */
  updateMediaSession(args: string): boolean
  hideMediaSession(): boolean
  /** Moves the app to the background while the media notification plays, else closes it. */
  exitApp(): void
}

const native = () => (typeof window === 'undefined' ? undefined : (window as { NativeInterface?: NativeInterface }).NativeInterface)

export const inJellyfinApp = () => !!native()

export const openAppSettings = () => native()?.openClientSettings()

export const openServerSelection = () => native()?.openServerSelection()

/** Lets the app hide the system bars and turn to landscape (the video player), or undo that. */
export const setAppFullscreen = (on: boolean) => (on ? native()?.enableFullscreen() : native()?.disableFullscreen())

export const exitApp = () => native()?.exitApp()

/** What the app's media notification shows; times in milliseconds. */
export interface AppMediaSession {
  itemId: string
  title: string
  artist: string
  album: string
  imageUrl: string
  position: number
  duration: number
  canSeek: boolean
  isPaused: boolean
}

export function updateAppMediaSession(session: AppMediaSession | null) {
  const app = native()
  if (!app) return
  if (!session) return void app.hideMediaSession()
  // `isLocalPlayer: false` would turn the volume keys into a remote volume control.
  app.updateMediaSession(JSON.stringify({ action: session.isPaused ? 'pause' : 'timeupdate', isLocalPlayer: true, ...session }))
}

/** The commands the media notification sends (the names are jellyfin-web's). */
export interface AppPlaybackManager {
  unpause(): void
  pause(): void
  playPause(): void
  previousTrack(): void
  nextTrack(): void
  rewind(): void
  fastForward(): void
  stop(): void
  seekMs(ms: number): void
  volumeUp(): void
  volumeDown(): void
  sendCommand(command: { Name: string; Arguments?: Record<string, unknown> }): void
}

const ignore = () => undefined

/** What the app calls into; filled in by the back handling and the music player as they load. */
const NavigationHelper: { goBack(): void; playbackManager: AppPlaybackManager } = {
  goBack: ignore,
  playbackManager: {
    unpause: ignore,
    pause: ignore,
    playPause: ignore,
    previousTrack: ignore,
    nextTrack: ignore,
    rewind: ignore,
    fastForward: ignore,
    stop: ignore,
    seekMs: ignore,
    volumeUp: ignore,
    volumeDown: ignore,
    sendCommand: ignore,
  },
}

if (native()) (window as { NavigationHelper?: typeof NavigationHelper }).NavigationHelper = NavigationHelper

export function setAppBackHandler(goBack: () => void) {
  NavigationHelper.goBack = goBack
}

export function setAppPlaybackManager(manager: AppPlaybackManager) {
  NavigationHelper.playbackManager = manager
}
