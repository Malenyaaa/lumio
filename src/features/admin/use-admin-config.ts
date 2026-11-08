import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthedSession } from '@/features/auth/session'
import { useUserConfiguration } from '@/features/settings/use-user-configuration'
import { messagesFor } from '@/lib/i18n'
import { configOptions } from './branding'
import { fetchConfig, saveConfig, type LumioConfig } from './lumio-config'
import { adminMessages } from './messages'

export function useIsAdmin() {
  return !!useUserConfiguration().data?.Policy?.IsAdministrator
}

/**
 * Saves a change to the server-wide config. The current config is read fresh from the server first, so a save never
 * undoes what another admin changed meanwhile (beyond the fields this change sets).
 */
export function useSaveConfig() {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const { queryKey } = configOptions(session.serverUrl)
  return useMutation({
    scope: { id: 'lumio-config' },
    mutationFn: async (change: (current: LumioConfig) => LumioConfig) => {
      const next = change(await fetchConfig(session.serverUrl))
      await saveConfig(api, next)
      return next
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next)
      toast.success(messagesFor(adminMessages).saved)
    },
    onError: () => toast.error(messagesFor(adminMessages).saveFailed),
  })
}

/** Reads an uploaded image as a data URL, scaled down to `maxSize` px (SVGs are kept as they are). */
export async function readImage(file: File, maxSize: number): Promise<string> {
  const t = messagesFor(adminMessages)
  if (file.size > 1024 * 1024) throw new Error(t.imageTooLarge)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(t.imageUnreadable))
    reader.readAsDataURL(file)
  })
  if (file.type === 'image/svg+xml') return dataUrl

  const image = new Image()
  image.src = dataUrl
  await image.decode().catch(() => {
    throw new Error(t.imageUnreadable)
  })
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  // PNG keeps transparency, which logos and icons need.
  return canvas.toDataURL('image/png')
}
