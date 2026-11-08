import { useEffect } from 'react'
import { socialCall } from '@/features/social/social'
import { accountPart, applyAccountSettings, readLocalSettings, setAccountUploader, type LocalSettings } from './local-settings'

interface AccountSettings {
  data: Record<string, unknown>
  /** When they last changed on the server; 0 = never saved there. */
  updated: number
}

/** Changes not yet on the server (it was unreachable), sent first when it is back. */
const pendingKey = (userId: string) => `lumio.settings.pending.${userId}`

function readPending(userId: string): Partial<LocalSettings> {
  try {
    return JSON.parse(localStorage.getItem(pendingKey(userId)) ?? '{}') as Partial<LocalSettings>
  } catch {
    return {}
  }
}

function writePending(userId: string, pending: Partial<LocalSettings>) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(pendingKey(userId), JSON.stringify(pending))
    else localStorage.removeItem(pendingKey(userId))
  } catch {
    // Kept for this visit only.
  }
}

/** Changes are collected this long before going out, so a slider dragged across doesn't send every step. */
const SEND_AFTER_MS = 400

/**
 * Keeps the settings that follow the account (see ACCOUNT_SETTINGS) in step with the Lumio server: on connecting it
 * takes the account's over (or, the first time, uploads this device's), changes made here go up, and changes made on
 * another device arrive live (`settings` events, handed in by the caller's event stream).
 */
export function useAccountSettingsSync(base: string, token: string, userId: string) {
  useEffect(() => {
    if (!base) return
    let cancelled = false
    let queued: Partial<LocalSettings> = {}
    let timer = 0

    const flush = async () => {
      const patch = { ...readPending(userId), ...queued }
      queued = {}
      if (!Object.keys(patch).length) return
      writePending(userId, patch)
      try {
        await socialCall(base, token, '/me/settings', { method: 'PATCH', body: JSON.stringify(patch) })
        // Only what went out is done; anything changed meanwhile is still queued.
        writePending(userId, {})
      } catch {
        // Stays pending until the server is reachable again.
      }
    }

    setAccountUploader({
      userId,
      send: (patch) => {
        queued = { ...queued, ...patch }
        window.clearTimeout(timer)
        timer = window.setTimeout(() => void flush(), SEND_AFTER_MS)
      },
    })

    void (async () => {
      // What was changed here while the server was away goes up first, so it isn't overwritten by the older copy.
      await flush()
      const settings = await socialCall<AccountSettings>(base, token, '/me/settings').catch(() => null)
      if (cancelled || !settings) return
      if (settings.updated === 0) {
        // Never saved for this account: this device's choices become the account's.
        await socialCall(base, token, '/me/settings', { method: 'PATCH', body: JSON.stringify(accountPart(readLocalSettings(userId))) }).catch(() => undefined)
      } else applyAccountSettings(userId, settings.data)
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      void flush()
      setAccountUploader(null)
    }
  }, [base, token, userId])
}

/** A `settings` event from the server: another device (or this one) changed the account's settings. */
export function onAccountSettingsEvent(userId: string, data: string) {
  const settings = JSON.parse(data) as AccountSettings
  applyAccountSettings(userId, settings.data)
}
