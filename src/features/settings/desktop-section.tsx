import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { desktop, type DesktopSettings } from '@/lib/desktop'
import { useMessages } from '@/lib/i18n'
import { Row, Section, SelectField, SwitchField } from './fields'
import { interfaceMessages } from './messages'

/** The desktop app's own settings (kept by the app, not the account): start, closing, the window frame. */
export function DesktopSection() {
  const app = desktop()
  const t = useMessages(interfaceMessages)
  const [settings, setSettings] = useState<DesktopSettings | null>(null)
  // The frame the window was made with: changing it takes a restart.
  const [framelessAtStart, setFramelessAtStart] = useState<boolean | null>(null)
  useEffect(() => {
    void app?.getSettings().then((loaded) => {
      setSettings(loaded)
      setFramelessAtStart(loaded.frameless)
    })
  }, [app])
  if (!app || !settings) return null
  const update = (patch: Partial<DesktopSettings>) => {
    setSettings({ ...settings, ...patch })
    void app.setSettings(patch).then(setSettings)
  }
  return (
    <Section title={t.desktop} scope="device">
      <SwitchField id="desktop-autostart" label={t.autostartLabel} hint={t.autostartHint} checked={settings.autostart} onChange={(autostart) => update({ autostart })} />
      {settings.autostart && (
        <SwitchField
          id="desktop-start-hidden"
          label={t.startHiddenLabel}
          hint={t.startHiddenHint}
          checked={settings.startHidden}
          onChange={(startHidden) => update({ startHidden })}
        />
      )}
      <SelectField
        id="desktop-start-in"
        label={t.startInLabel}
        hint={t.startInHint}
        value={settings.startIn}
        options={[
          { value: 'last', label: t.startInLast },
          { value: 'watch', label: 'Watch' },
          { value: 'listen', label: 'Listen' },
        ]}
        onChange={(startIn) => update({ startIn })}
      />
      <SelectField
        id="desktop-close"
        label={t.closeLabel}
        hint={t.closeHint}
        value={settings.closeAction}
        options={[
          { value: 'tray', label: t.closeTray },
          { value: 'minimize', label: t.closeMinimize },
          { value: 'quit', label: t.closeQuit },
        ]}
        onChange={(closeAction) => update({ closeAction })}
      />
      <SwitchField id="desktop-frameless" label={t.framelessLabel} hint={t.framelessHint} checked={settings.frameless} onChange={(frameless) => update({ frameless })} />
      {framelessAtStart !== null && settings.frameless !== framelessAtStart && (
        <Row label={t.restartHint}>
          <Button variant="secondary" onClick={() => void app.relaunch()}>
            {t.restart}
          </Button>
        </Row>
      )}
    </Section>
  )
}
