import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthedSession } from '@/features/auth/session'
import { onAccountSettingsEvent, useAccountSettingsSync } from '@/features/settings/account-sync'
import { socialCall, setSocialConnection, setSocialSharing, useSocialMe, useSocialUrl, type FriendActivity } from './social'

/**
 * Connects Lumio to its server while signed in: hands the players the connection (they report what plays), carries
 * over follows Lumio kept before the server existed, keeps the account's settings in step, and listens for live
 * updates (friends' activity, new followers, settings changed on another device).
 */
export function SocialHost() {
  const { session } = useAuthedSession()
  const base = useSocialUrl()
  const queryClient = useQueryClient()
  const me = useSocialMe()

  useEffect(() => {
    setSocialConnection(base ? { base, token: session.accessToken } : null)
    return () => setSocialConnection(null)
  }, [base, session.accessToken])

  // Settings that follow the account.
  useAccountSettingsSync(base, session.accessToken, session.userId)

  useEffect(() => setSocialSharing(!!me.data?.privacy.shareActivity), [me.data?.privacy.shareActivity])

  // Follows kept in the Listen library (before the server) move over once.
  useEffect(() => {
    if (!base || !me.isSuccess) return
    const flag = `lumio.social.imported.${session.userId}`
    try {
      if (localStorage.getItem(flag)) return
      localStorage.setItem(flag, '1')
    } catch {
      return
    }
    void (async () => {
      const library = queryClient.getQueryData<{ saved: string[] }>(['listen-library', session.userId])
      const ids = (library?.saved ?? []).filter((entry) => entry.startsWith('user:')).map((entry) => entry.slice(5))
      if (!ids.length) return
      await socialCall(base, session.accessToken, '/me/follows/import', { method: 'POST', body: JSON.stringify({ ids }) }).catch(() => undefined)
      void queryClient.invalidateQueries({ queryKey: ['social'] })
    })()
  }, [base, me.isSuccess, session.userId, session.accessToken, queryClient])

  // Live: a friend's activity replaces their entry; a new follower refreshes the counts.
  useEffect(() => {
    if (!base) return
    const events = new EventSource(`${base}/events?token=${encodeURIComponent(session.accessToken)}`)
    events.addEventListener('activity', (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as FriendActivity
      queryClient.setQueryData<FriendActivity[]>(['social', 'activity', base], (list) =>
        [update, ...(list ?? []).filter((entry) => entry.user.id !== update.user.id)].filter((entry) => entry.activity).sort((a, b) => b.activity!.at - a.activity!.at),
      )
      void queryClient.invalidateQueries({ queryKey: ['social', 'user', base, update.user.id] })
    })
    events.addEventListener('follow', () => void queryClient.invalidateQueries({ queryKey: ['social', 'me'] }))
    events.addEventListener('settings', (event) => onAccountSettingsEvent(session.userId, (event as MessageEvent<string>).data))
    return () => events.close()
  }, [base, session.accessToken, session.userId, queryClient])

  return null
}
