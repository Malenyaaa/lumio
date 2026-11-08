import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IconExternalLink } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthedSession } from '@/features/auth/session'
import { config } from '@/lib/config'
import { messagesFor, useMessages } from '@/lib/i18n'
import { DevicesSection } from './devices-section'
import { Row, Section, SettingsPage } from './fields'
import { profileMessages } from './messages'
import { userOptions, useUserConfiguration } from './use-user-configuration'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** The file's contents as plain base64 (without the `data:…;base64,` prefix). */
function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ProfilePage() {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const user = useUserConfiguration()
  const fileInput = useRef<HTMLInputElement>(null)
  const t = useMessages(profileMessages)

  const hasImage = !!user.data?.PrimaryImageTag
  const imageUrl = user.data ? getImageApi(api).getUserImageUrl(user.data, { width: 240 }) : undefined
  /**
   * Reloads the user until the image tag has changed: the server may still answer with the old tag right after the
   * upload, and the avatar URLs (header, this page) only change, and so only reload the picture, with the tag.
   */
  const refreshUser = async () => {
    const before = user.data?.PrimaryImageTag
    for (let attempt = 0; attempt < 6; attempt++) {
      const fresh = await queryClient.fetchQuery({ ...userOptions(api, session.userId), staleTime: 0 })
      if (fresh.PrimaryImageTag !== before) return
      await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  const upload = useMutation({
    // Jellyfin reads the request body as base64 text (like jellyfin-web sends it), not as raw image bytes.
    mutationFn: async (file: File) =>
      getImageApi(api).postUserImage(
        { userId: session.userId, body: (await fileToBase64(file)) as unknown as File },
        { headers: { 'Content-Type': file.type } },
      ),
    onSuccess: () => {
      toast.success(messagesFor(profileMessages).imageUpdated)
      return refreshUser()
    },
    onError: () => toast.error(messagesFor(profileMessages).uploadFailed),
  })

  const remove = useMutation({
    mutationFn: () => getImageApi(api).deleteUserImage({ userId: session.userId }),
    onSuccess: () => {
      toast.success(messagesFor(profileMessages).imageRemoved)
      return refreshUser()
    },
    onError: () => toast.error(messagesFor(profileMessages).removeFailed),
  })

  function onFileChosen(file?: File) {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error(t.notAnImage)
    if (file.size > MAX_IMAGE_BYTES) return void toast.error(t.tooLarge)
    upload.mutate(file)
  }

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section anchor="profile-image" title={t.image}>
        <div className="flex items-center gap-5 p-4">
          <Avatar className="size-20">
            {imageUrl && <AvatarImage src={imageUrl} alt="" />}
            <AvatarFallback className="text-xl">{session.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                {hasImage ? t.changeImage : t.addImage}
              </Button>
              {hasImage && (
                <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  {t.remove}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.imageFormats}</p>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => onFileChosen(event.target.files?.[0])} />
          </div>
        </div>
      </Section>

      <Section title={t.account}>
        <Row label={t.username} hint={t.usernameHint}>
          <p className="text-sm">{user.data?.Name ?? session.userName}</p>
        </Row>
      </Section>

      {config.passwordChangeDisabled ? <ManagedAccountSection /> : <PasswordSection />}

      <DevicesSection />
    </SettingsPage>
  )
}

/** Replaces the password form when accounts live at an identity provider. */
function ManagedAccountSection() {
  const t = useMessages(profileMessages)
  return (
    <Section anchor="password" title={t.passwordAndSignIn}>
      <div className="space-y-3 p-4">
        <p className="max-w-prose text-sm text-muted-foreground">
          {t.managedAccount}
        </p>
        {config.accountUrl && (
          <Button variant="outline" nativeButton={false} render={<a href={config.accountUrl} target="_blank" rel="noreferrer noopener" />}>
            {t.openAccount}
            <IconExternalLink />
          </Button>
        )}
      </div>
    </Section>
  )
}

function PasswordSection() {
  const { api, session } = useAuthedSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<'failed' | 'mismatch' | 'empty' | null>(null)
  const t = useMessages(profileMessages)

  const change = useMutation({
    mutationFn: () =>
      getUserApi(api).updateUserPassword({ userId: session.userId, updateUserPassword: { CurrentPw: current, NewPw: next } }),
    onSuccess: () => {
      toast.success(messagesFor(profileMessages).passwordChanged)
      setCurrent('')
      setNext('')
      setConfirm('')
      setError(null)
    },
    onError: () => setError('failed'),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (next !== confirm) return setError('mismatch')
    if (!next) return setError('empty')
    setError(null)
    change.mutate()
  }

  return (
    <Section anchor="password" title={t.changePassword} description={t.changePasswordDescription}>
      <form onSubmit={onSubmit} className="grid gap-4 p-4 sm:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="pw-current">{t.currentPassword}</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
          <p className="text-xs text-muted-foreground">{t.currentPasswordHint}</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pw-new">{t.newPassword}</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pw-confirm">{t.confirmPassword}</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{{ failed: t.passwordFailed, mismatch: t.passwordMismatch, empty: t.passwordEmpty }[error]}</p>}
        <div>
          <Button type="submit" disabled={change.isPending}>
            {t.savePassword}
          </Button>
        </div>
      </form>
    </Section>
  )
}
