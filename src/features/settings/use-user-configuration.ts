import type { Api } from '@jellyfin/sdk'
import type { UserConfiguration, UserDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthedSession } from '@/features/auth/session'
import { messagesFor } from '@/lib/i18n'
import { fieldMessages } from './messages'

export const userOptions = (api: Api, userId: string) =>
  queryOptions({
    queryKey: ['user-config', userId],
    staleTime: 5 * 60_000,
    queryFn: async () => (await getUserApi(api).getUserById({ userId })).data,
  })

/** The signed-in user (name, avatar tag, policy) with their Jellyfin settings (language preferences, autoplay, ...). */
export function useUserConfiguration() {
  const { api, session } = useAuthedSession()
  return useQuery(userOptions(api, session.userId))
}

/**
 * Saves account-wide settings right away. Switches react instantly (the cache is patched first), but what is sent is
 * always the server's current configuration plus the change: the endpoint replaces the whole configuration, so a stale
 * copy would undo changes made in other apps meanwhile. Saves run one after another, and the cache is reloaded after
 * each one instead of restoring an old snapshot, which could wipe a newer change.
 */
export function useUpdateConfiguration() {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const options = userOptions(api, session.userId)

  return useMutation({
    scope: { id: `user-config:${session.userId}` },
    mutationFn: async (patch: Partial<UserConfiguration>) => {
      const fresh = await queryClient.fetchQuery({ ...options, staleTime: 0 })
      if (!fresh.Configuration) throw new Error('No configuration to update')
      await getUserApi(api).updateUserConfiguration({ userId: session.userId, userConfiguration: { ...fresh.Configuration, ...patch } })
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey })
      queryClient.setQueryData<UserDto>(options.queryKey, (user) => (user ? { ...user, Configuration: { ...user.Configuration, ...patch } } : user))
    },
    onError: () => toast.error(messagesFor(fieldMessages).saveFailed),
    onSuccess: () => toast.success(messagesFor(fieldMessages).saved, { id: 'settings-saved', duration: 1500 }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: options.queryKey }),
  })
}
