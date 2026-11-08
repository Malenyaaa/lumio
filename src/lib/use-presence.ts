import { useEffect, useState } from 'react'

/**
 * Keeps something mounted for `exitMs` after it is closed, so it can play an exit animation: `mounted` says whether to
 * render it, `closing` whether the exit is running.
 */
export function usePresence(open: boolean, exitMs = 200) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    if (open || !mounted) return
    const timer = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(timer)
  }, [open, mounted, exitMs])
  return { mounted, closing: mounted && !open }
}
