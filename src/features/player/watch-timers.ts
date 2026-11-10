import { useSyncExternalStore } from 'react'

/**
 * Watch's two guards against a video playing on all night: the sleep timer (pauses after some minutes, or once the
 * episode has ended) and the break reminder (after a while of watching without a real pause, playback pauses and asks).
 * Both outlast the player of one episode: they live here, and the player that is open hands in how to pause. Only for
 * this tab and this session; music has its own sleep timer.
 */
export interface VideoSleepTimer {
  /** When it pauses (ms since epoch), or null. */
  endsAt: number | null
  /** Stops when the video playing has ended, instead of going on to the next episode. */
  endOfVideo: boolean
}

/** Not watching for this long (paused, or the player closed) counts as a break: the reminder starts over. */
const BREAK_RESETS_AFTER_MS = 15 * 60_000

let sleep: VideoSleepTimer = { endsAt: null, endOfVideo: false }
let sleepTimeout: number | undefined
let pauseHandler: (() => void) | null = null
const sleepListeners = new Set<() => void>()

function setSleep(next: VideoSleepTimer) {
  sleep = next
  for (const listener of sleepListeners) listener()
}

/** The open player's way to pause (null when it closes). */
export function setVideoPauseHandler(handler: (() => void) | null) {
  pauseHandler = handler
}

/** Pauses after `minutes`, at the end of the video (`'video'`), or switches the timer off (null). */
export function setVideoSleepTimer(choice: number | 'video' | null) {
  window.clearTimeout(sleepTimeout)
  if (choice === null) return setSleep({ endsAt: null, endOfVideo: false })
  if (choice === 'video') return setSleep({ endsAt: null, endOfVideo: true })
  sleepTimeout = window.setTimeout(() => {
    setSleep({ endsAt: null, endOfVideo: false })
    pauseHandler?.()
  }, choice * 60_000)
  setSleep({ endsAt: Date.now() + choice * 60_000, endOfVideo: false })
}

/** At a video's end: whether to stop here rather than play the next one (the timer is done then). */
export function sleepsAfterVideo() {
  if (!sleep.endOfVideo) return false
  setSleep({ endsAt: null, endOfVideo: false })
  return true
}

export function useVideoSleepTimer(): VideoSleepTimer {
  return useSyncExternalStore(
    (listener) => {
      sleepListeners.add(listener)
      return () => sleepListeners.delete(listener)
    },
    () => sleep,
  )
}

let watchedSeconds = 0
let lastWatchedAt = 0

/**
 * Counts seconds really watched (the player hands in each step while playing) and tells when `limitMinutes` of them
 * have come together without a break in between; the count then starts over. 0 switches the reminder off.
 */
export function noteWatched(seconds: number, limitMinutes: number) {
  const now = Date.now()
  if (now - lastWatchedAt > BREAK_RESETS_AFTER_MS) watchedSeconds = 0
  lastWatchedAt = now
  watchedSeconds += seconds
  if (limitMinutes <= 0 || watchedSeconds < limitMinutes * 60) return false
  watchedSeconds = 0
  return true
}
