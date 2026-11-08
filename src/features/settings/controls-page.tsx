import { inCapacitor } from '@/lib/capacitor'
import { useMessages } from '@/lib/i18n'
import { Row, Section, SelectField, SettingsPage, SwitchField } from './fields'
import { useLocalSettings } from './local-settings'
import { controlsMessages, fieldMessages } from './messages'

// `space` is the only key name that needs translating; the others are symbols or letters.
const SHORTCUTS = [
  { keys: ['space', 'K'], action: 'playPause' },
  { keys: ['←', 'J'], action: 'seekBack' },
  { keys: ['→', 'L'], action: 'seekForward' },
  { keys: ['↑', '↓'], action: 'volume' },
  { keys: ['M'], action: 'mute' },
  { keys: ['F'], action: 'fullscreen' },
  { keys: ['N'], action: 'next' },
  { keys: ['Esc'], action: 'closeMenu' },
  { keys: ['/'], action: 'openSearch' },
] as const

function Key({ children }: { children: string }) {
  return <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</kbd>
}

export function ControlsPage() {
  const { settings, update } = useLocalSettings()
  const t = useMessages(controlsMessages)
  const { seconds } = useMessages(fieldMessages)
  const hideOptions = [2, 3, 5, 8].map((value) => ({ value, label: seconds(value) }))
  const spotlightOptions = [{ value: 0, label: t.never }, ...[5, 10, 20, 30].map((value) => ({ value, label: t.afterSeconds(value) }))]

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.keyboard} scope="account">
        <SwitchField
          id="keyboard-shortcuts"
          label={t.shortcutsLabel}
          hint={t.shortcutsHint}
          checked={settings.keyboardShortcuts}
          onChange={(checked) => update({ keyboardShortcuts: checked })}
        />
        <div className="p-4">
          <h3 className="mb-3 text-sm font-medium">{t.shortcuts}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SHORTCUTS.map(({ keys, action }) => (
              <li key={action} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{t[action]}</span>
                <span className="flex shrink-0 gap-1">
                  {keys.map((key) => (
                    <Key key={key}>{key === 'space' ? t.space : key}</Key>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title={t.player} scope="account">
        <SelectField
          id="controls-hide"
          label={t.hideLabel}
          hint={t.hideHint}
          value={settings.controlsHideSeconds}
          options={hideOptions}
          onChange={(value) => update({ controlsHideSeconds: value })}
        />
        <SelectField
          id="pause-spotlight"
          label={t.spotlightLabel}
          hint={t.spotlightHint}
          value={settings.pauseSpotlightSeconds}
          options={spotlightOptions}
          onChange={(value) => update({ pauseSpotlightSeconds: value })}
        />
      </Section>

      {/* Only Lumio's Android app can shrink a video into a floating window on its own. */}
      {inCapacitor() && (
        <Section title={t.app} scope="device">
          <SwitchField id="auto-pip" label={t.autoPipLabel} hint={t.autoPipHint} checked={settings.autoPip} onChange={(checked) => update({ autoPip: checked })} />
          <SwitchField id="auto-update" label={t.autoUpdateLabel} hint={t.autoUpdateHint} checked={settings.autoUpdate} onChange={(checked) => update({ autoUpdate: checked })} />
          <SwitchField
            id="player-gestures"
            label={t.gesturesLabel}
            hint={t.gesturesHint}
            checked={settings.playerGestures}
            onChange={(checked) => update({ playerGestures: checked })}
          />
        </Section>
      )}

      <Section title={t.controller} scope="device">
        <Row label={t.gamepadLabel} hint={t.gamepadHint}>
          <p className="text-sm text-muted-foreground sm:text-right">{t.notAvailable}</p>
        </Row>
      </Section>
    </SettingsPage>
  )
}
