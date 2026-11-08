import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api'
import { IconExternalLink } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { appVersion, applyUpdate, checkForUpdate, useReadyUpdate } from '@/lib/app-update'
import { useAuthedSession } from '@/features/auth/session'
import { inCapacitor } from '@/lib/capacitor'
import { desktop, type UpdateCheck } from '@/lib/desktop'
import { useMessages } from '@/lib/i18n'
import { appMessages } from './messages'
import { DesktopSection } from './desktop-section'
import { Row, Section, SettingsPage, SwitchField } from './fields'
import { useLocalSettings } from './local-settings'
import { inLumioApp } from './settings-pages'

const REPOSITORY = 'https://github.com/PalmarHealer/lumio'

/** In Lumio's apps: their own settings and the version; in a browser: only which version and server this is. */
export function AppPage() {
  const t = useMessages(appMessages)
  const { settings, update } = useLocalSettings()
  const app = inLumioApp()
  return (
    <SettingsPage title={app ? t.appTitle : t.aboutTitle} description={app ? t.appDescription : t.aboutDescription} resetKeys={inCapacitor() ? ['autoUpdate', 'autoPip'] : undefined}>
      {/* Only Lumio's Android app updates itself this way and shrinks a video into a floating window on its own. */}
      {inCapacitor() && (
        <Section title={t.android} scope="device">
          <SwitchField id="auto-update" label={t.autoUpdateLabel} hint={t.autoUpdateHint} checked={settings.autoUpdate} onChange={(checked) => update({ autoUpdate: checked })} />
          <SwitchField id="auto-pip" label={t.autoPipLabel} hint={t.autoPipHint} checked={settings.autoPip} onChange={(checked) => update({ autoPip: checked })} />
        </Section>
      )}
      {/* Only in the desktop app (Windows, Linux). */}
      <DesktopSection />
      <AboutSection />
    </SettingsPage>
  )
}

function AboutSection() {
  const t = useMessages(appMessages)
  const { api } = useAuthedSession()
  const version = useQuery({ queryKey: ['app-version'], queryFn: appVersion, staleTime: Infinity })
  const server = useQuery({
    queryKey: ['public-system-info', api.basePath],
    queryFn: async () => (await getSystemApi(api).getPublicSystemInfo()).data,
    staleTime: 60 * 60_000,
  })
  return (
    <Section anchor="about" title={t.about}>
      {version.data && (
        <Row label={t.version}>
          <p className="text-sm tabular-nums sm:text-right">{version.data}</p>
        </Row>
      )}
      <Row label={t.build}>
        <p className="font-mono text-sm sm:text-right">{__LUMIO_BUILD__}</p>
      </Row>
      {server.data && (
        <Row label={t.server}>
          <p className="truncate text-sm sm:text-right">{[server.data.ServerName, server.data.Version].filter(Boolean).join(' · ')}</p>
        </Row>
      )}
      {inLumioApp() && <UpdateRow />}
      <Row label={t.source} hint={t.sourceHint}>
        <div className="flex sm:justify-end">
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={REPOSITORY} target="_blank" rel="noreferrer" />}>
            {t.openGithub} <IconExternalLink />
          </Button>
        </div>
      </Row>
    </Section>
  )
}

/** "Check for updates" (also with automatic updates off); a downloaded one is offered right here. */
function UpdateRow() {
  const t = useMessages(appMessages)
  const ready = useReadyUpdate()
  const [state, setState] = useState<UpdateCheck | 'checking' | null>(null)
  // An older desktop app can't be asked.
  if (desktop() && !desktop()!.checkUpdate) return null
  const hint = ready ? t.readyHint(ready.version) : state === 'current' ? t.current : state === 'failed' ? t.failed : undefined
  return (
    <Row label={t.updates} hint={hint}>
      <div className="flex sm:justify-end">
        {ready ? (
          <Button size="sm" onClick={applyUpdate}>
            {t.install}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={state === 'checking'}
            onClick={() => {
              setState('checking')
              void checkForUpdate(true).then(setState)
            }}
          >
            {state === 'checking' ? t.checking : t.check}
          </Button>
        )}
      </div>
    </Row>
  )
}
