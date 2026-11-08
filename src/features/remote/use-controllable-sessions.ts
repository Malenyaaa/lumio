import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api'
import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'
import { jellyfin } from '@/lib/jellyfin'

const REFRESH_MS = 4000

/** Devices that can be remote-controlled right now: the user's own, and for admins also other users' (never this browser itself). */
export function useControllableSessions(enabled: boolean) {
  const { api, session } = useAuthedSession()
  return useQuery({
    queryKey: ['controllable-sessions', session.userId],
    enabled,
    refetchInterval: enabled ? REFRESH_MS : false,
    queryFn: async (): Promise<SessionInfoDto[]> =>
      (await getSessionApi(api).getSessions({ controllableByUserId: session.userId })).data.filter(
        (entry) => entry.SupportsRemoteControl && entry.DeviceId !== jellyfin.deviceInfo.id,
      ),
  })
}
