import { useQuery } from '@tanstack/react-query'
import { IconDeviceMobile, IconKey, IconLoader2 } from '@tabler/icons-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useLanguagePreference, useLocale, useMessages, type Locale } from '@/lib/i18n'
import { DEFAULT_SERVER_URL } from '@/lib/jellyfin'
import { cn } from '@/lib/utils'
import { loginMessages } from './messages'
import { useSession } from './session'
import { isQuickConnectEnabled, useQuickConnect } from './use-quick-connect'
import { useBranding } from '@/features/admin/branding'
import { markAppReady } from '@/lib/boot'
import { config } from '@/lib/config'

export function LoginPage() {
  const { session } = useSession()
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL)
  const [mode, setMode] = useState<'quick-connect' | 'password'>('quick-connect')
  const t = useMessages(loginMessages)
  const { appName, logo } = useBranding()

  const quickConnectEnabled = useQuery({
    queryKey: ['quick-connect-enabled', serverUrl],
    queryFn: () => isQuickConnectEnabled(serverUrl),
    enabled: URL.canParse(serverUrl),
    retry: false,
  })

  // Signed out: the login form is the first view, nothing else to wait for.
  useEffect(() => {
    if (!session) markAppReady()
  }, [session])

  if (session) return <Navigate to="/" replace />

  const showPassword = mode === 'password' || quickConnectEnabled.data === false

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">
            {logo ? <img src={logo} alt={appName} className="h-10 w-auto max-w-56 object-contain" /> : appName}
          </CardTitle>
          <CardDescription>{t.signInTo}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {!config.serverLocked && (
            <div className="grid gap-2">
              <Label htmlFor="server">{t.server}</Label>
              <Input id="server" type="url" required value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            </div>
          )}

          {showPassword ? <PasswordForm serverUrl={serverUrl} /> : <QuickConnectPanel serverUrl={serverUrl} />}

          {quickConnectEnabled.data && (
            <>
              <Separator />
              <Button variant="ghost" onClick={() => setMode(showPassword ? 'quick-connect' : 'password')}>
                {showPassword ? (
                  <>
                    <IconDeviceMobile /> {t.withQuickConnect}
                  </>
                ) : (
                  <>
                    <IconKey /> {t.withPassword}
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <LanguageSwitch />
    </main>
  )
}

// Names in their own language, so each can be found whatever language is showing.
const LANGUAGES: Array<{ value: Locale; label: string }> = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
]

/** The settings can't be reached before signing in, so the language can be picked here too. */
function LanguageSwitch() {
  const t = useMessages(loginMessages)
  const locale = useLocale()
  const [, setLanguage] = useLanguagePreference()

  return (
    <div role="group" aria-label={t.language} className="flex gap-1">
      {LANGUAGES.map(({ value, label }) => (
        <Button
          key={value}
          variant="ghost"
          size="xs"
          lang={value}
          aria-pressed={locale === value}
          onClick={() => setLanguage(value)}
          className={cn(locale === value ? 'text-foreground' : 'text-muted-foreground')}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

function QuickConnectPanel({ serverUrl }: { serverUrl: string }) {
  const { status, start, cancel } = useQuickConnect(serverUrl)
  const t = useMessages(loginMessages)

  if (status.state === 'waiting') {
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t.quickConnectBefore} <span className="text-foreground">{t.quickConnectPath}</span> {t.quickConnectAfter}
        </p>
        <p className="font-mono text-4xl font-semibold tracking-[0.3em]" aria-live="polite">
          {status.code}
        </p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" /> {t.waiting}
        </p>
        <Button variant="outline" onClick={cancel}>
          {t.cancel}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {status.state === 'error' && <p className="text-sm text-destructive">{status.reason === 'start' ? t.startFailed : t.codeExpired}</p>}
      <Button onClick={() => void start()} disabled={status.state === 'starting'}>
        {status.state === 'starting' ? <IconLoader2 className="animate-spin" /> : <IconDeviceMobile />}
        {t.requestCode}
      </Button>
    </div>
  )
}

function PasswordForm({ serverUrl }: { serverUrl: string }) {
  const { login } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const t = useMessages(loginMessages)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setFailed(false)
    try {
      await login(serverUrl, username, password)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="username">{t.username}</Label>
        <Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{t.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {failed && <p className="text-sm text-destructive">{t.signInFailed}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t.signingIn : t.signIn}
      </Button>
    </form>
  )
}
