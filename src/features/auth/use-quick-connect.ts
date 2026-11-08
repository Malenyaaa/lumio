import type { QuickConnectResult } from '@jellyfin/sdk/lib/generated-client/models'
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createApi } from '@/lib/jellyfin'
import { useSession } from './session'

const POLL_INTERVAL_MS = 3000

export type QuickConnectStatus =
  | { state: 'idle' }
  | { state: 'starting' }
  | { state: 'waiting'; code: string }
  /** `start`: the server refused or was unreachable; `expired`: the code ran out before it was approved. */
  | { state: 'error'; reason: 'start' | 'expired' }

/**
 * Quick Connect: the server hands out a short code, the user approves it in an
 * already signed-in client (e.g. jellyfin-web via SSO), and we exchange the secret for a token.
 */
export function useQuickConnect(serverUrl: string) {
  const { completeSignIn } = useSession()
  const [status, setStatus] = useState<QuickConnectStatus>({ state: 'idle' })
  const timer = useRef<number | undefined>(undefined)
  // Bumped by every stop: a request that comes back after a cancel (or for an old server address) sees a newer
  // generation and does nothing, so no hidden polling continues and nobody gets signed in unexpectedly.
  const generation = useRef(0)

  const stop = useCallback(() => {
    generation.current += 1
    window.clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const cancel = useCallback(() => {
    stop()
    setStatus({ state: 'idle' })
  }, [stop])

  const start = useCallback(async () => {
    stop()
    const mine = generation.current
    const current = () => generation.current === mine
    setStatus({ state: 'starting' })
    const auth = getAuthenticationApi(createApi(serverUrl))

    let initial: QuickConnectResult
    try {
      initial = (await auth.initiateQuickConnect()).data
    } catch {
      if (!current()) return
      setStatus({ state: 'error', reason: 'start' })
      return
    }
    if (!current()) return
    const secret = initial.Secret!
    setStatus({ state: 'waiting', code: initial.Code! })

    const poll = async () => {
      try {
        const { data } = await auth.getQuickConnectState({ secret })
        if (!current()) return
        if (data.Authenticated) {
          const result = (await auth.authenticateWithQuickConnect({ quickConnectDto: { Secret: secret } })).data
          if (!current()) return
          stop()
          completeSignIn(serverUrl, result)
          return
        }
        timer.current = window.setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        if (!current()) return
        stop()
        setStatus({ state: 'error', reason: 'expired' })
      }
    }
    timer.current = window.setTimeout(poll, POLL_INTERVAL_MS)
  }, [serverUrl, completeSignIn, stop])

  // Leaving the page or changing the server address ends a running code.
  useEffect(
    () => () => {
      stop()
      setStatus({ state: 'idle' })
    },
    [serverUrl, stop],
  )

  return { status, start, cancel }
}

export async function isQuickConnectEnabled(serverUrl: string): Promise<boolean> {
  try {
    return (await getAuthenticationApi(createApi(serverUrl)).getQuickConnectEnabled()).data
  } catch {
    return false
  }
}
