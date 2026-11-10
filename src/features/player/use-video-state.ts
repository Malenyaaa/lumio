import { useEffect, useState, type RefObject } from 'react'
import { levelOf } from '@/lib/loudness'

export interface VideoState {
  paused: boolean
  currentTime: number
  duration: number
  /** End of the buffered range that contains the playhead. */
  buffered: number
  /** Every buffered stretch, [start, end] in seconds: parts further on that were loaded before (jumped to and back) too. */
  ranges: Array<[number, number]>
  volume: number
  muted: boolean
  waiting: boolean
}

const BUFFER_POLL_MS = 250
const VOLUME_KEY = 'lumio.player.volume'
const MUTED_KEY = 'lumio.player.muted'

const initial: VideoState = { paused: true, currentTime: 0, duration: 0, buffered: 0, ranges: [], volume: 1, muted: false, waiting: true }

function read(el: HTMLVideoElement, waiting: boolean): VideoState {
  let buffered = 0
  const ranges: Array<[number, number]> = []
  for (let i = 0; i < el.buffered.length; i++) {
    if (el.buffered.start(i) <= el.currentTime && el.buffered.end(i) >= el.currentTime) buffered = el.buffered.end(i)
    ranges.push([el.buffered.start(i), el.buffered.end(i)])
  }
  return {
    paused: el.paused,
    currentTime: el.currentTime,
    duration: Number.isFinite(el.duration) ? el.duration : 0,
    buffered,
    ranges,
    // The slider's position, not the element's (linear) volume.
    volume: levelOf(el.volume),
    muted: el.muted,
    waiting,
  }
}

/** Whether a new reading is worth a re-render: timeupdate fires ~4×/s, but quarter seconds are all the UI shows. */
function changed(a: VideoState, b: VideoState) {
  const quarter = (seconds: number) => Math.floor(seconds * 4)
  return (
    a.paused !== b.paused ||
    a.waiting !== b.waiting ||
    a.muted !== b.muted ||
    a.volume !== b.volume ||
    a.duration !== b.duration ||
    quarter(a.currentTime) !== quarter(b.currentTime) ||
    quarter(a.buffered) !== quarter(b.buffered) ||
    a.ranges.length !== b.ranges.length ||
    a.ranges.some(([start, end], i) => quarter(start) !== quarter(b.ranges[i][0]) || quarter(end) !== quarter(b.ranges[i][1]))
  )
}

function restoreVolume(el: HTMLVideoElement) {
  try {
    const volume = Number(localStorage.getItem(VOLUME_KEY))
    if (localStorage.getItem(VOLUME_KEY) !== null && volume >= 0 && volume <= 1) el.volume = volume
    el.muted = localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    // Storage unavailable: keep the element defaults.
  }
}

function persistVolume(el: HTMLVideoElement) {
  try {
    localStorage.setItem(VOLUME_KEY, String(el.volume))
    localStorage.setItem(MUTED_KEY, el.muted ? '1' : '0')
  } catch {
    // Not critical.
  }
}

/** Mirrors the relevant parts of a <video> element into React state and remembers the volume. */
export function useVideoState(ref: RefObject<HTMLVideoElement | null>): VideoState {
  const [state, setState] = useState(initial)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    restoreVolume(el)

    let waiting = true
    const sync = () => {
      // Done waiting once there is data to go on and no seek is under way: after a seek into what is already buffered
      // (resuming where one left off), browsers fire neither "playing" nor "canplay" again.
      if (waiting && !el.seeking && el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        waiting = false
        stopPolling()
      }
      const next = read(el, waiting)
      setState((current) => (changed(current, next) ? next : current))
    }
    // Streams fed through Media Source Extensions don't fire reliable `progress` events, so the buffered range would
    // never update while loading; poll it for as long as we are waiting.
    let poll: number | undefined
    const startPolling = () => {
      if (poll === undefined) poll = window.setInterval(sync, BUFFER_POLL_MS)
    }
    const stopPolling = () => {
      window.clearInterval(poll)
      poll = undefined
    }
    const onWaiting = () => {
      waiting = true
      startPolling()
      sync()
    }
    const onReady = () => {
      waiting = false
      stopPolling()
      sync()
    }
    const onVolume = () => {
      persistVolume(el)
      sync()
    }

    const syncEvents = ['play', 'pause', 'timeupdate', 'durationchange', 'progress', 'seeked', 'loadedmetadata']
    syncEvents.forEach((name) => el.addEventListener(name, sync))
    el.addEventListener('volumechange', onVolume)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('seeking', onWaiting)
    el.addEventListener('playing', onReady)
    el.addEventListener('canplay', onReady)
    startPolling()
    sync()

    return () => {
      stopPolling()
      syncEvents.forEach((name) => el.removeEventListener(name, sync))
      el.removeEventListener('volumechange', onVolume)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('seeking', onWaiting)
      el.removeEventListener('playing', onReady)
      el.removeEventListener('canplay', onReady)
    }
  }, [ref])

  return state
}
