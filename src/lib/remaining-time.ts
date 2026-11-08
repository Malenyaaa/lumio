import { useSyncExternalStore } from 'react'
import { formatClock } from './format'

/**
 * Whether players show the length of what plays or the time left ("-1:23"), switched by clicking it; one choice for
 * the music bar and the video player, remembered on this device.
 */
const KEY = 'lumio.player.remaining'
const listeners = new Set<() => void>()

function read() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let remaining = read()

export function toggleRemainingTime() {
  remaining = !remaining
  try {
    localStorage.setItem(KEY, remaining ? '1' : '0')
  } catch {
    // Only for this visit.
  }
  for (const listener of listeners) listener()
}

export function useRemainingTime() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => remaining,
  )
}

/** The length, or the time left with a minus, as chosen. */
export function lengthLabel(position: number, duration: number, showRemaining: boolean) {
  return showRemaining ? `-${formatClock(Math.max(0, duration - position))}` : formatClock(duration)
}
