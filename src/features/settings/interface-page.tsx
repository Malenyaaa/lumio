import { getLocaleTag, useLanguagePreference, useLocale, useMessages, type LanguagePreference } from '@/lib/i18n'
import { useThemePreference } from '@/lib/theme'
import { Section, SelectField, SettingsPage, SwitchField } from './fields'
import { useLocalSettings } from './local-settings'
import { interfaceMessages } from './messages'

const HOVER_DELAYS = [250, 400, 550, 800, 1200]

// Language names are shown in their own language, so they can be found whatever the current one is.
const LANGUAGES: Array<{ value: LanguagePreference; label: string }> = [
  { value: 'auto', label: 'Automatisch / Automatic' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
]

export function InterfacePage() {
  const { settings, update } = useLocalSettings()
  const [language, setLanguage] = useLanguagePreference()
  const [theme, setTheme] = useThemePreference()
  const t = useMessages(interfaceMessages)
  const seconds = new Intl.NumberFormat(getLocaleTag(useLocale()), { style: 'unit', unit: 'second', unitDisplay: 'narrow' })
  const hoverDelays = HOVER_DELAYS.map((ms) => ({ value: ms, label: seconds.format(ms / 1000) }))

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.appearance} scope="device">
        <SelectField
          id="theme"
          label={t.themeLabel}
          hint={t.themeHint}
          value={theme}
          options={[
            { value: 'system', label: t.themeSystem },
            { value: 'dark', label: t.themeDark },
            { value: 'light', label: t.themeLight },
          ]}
          onChange={setTheme}
        />
      </Section>

      <Section title={t.language} scope="device">
        <SelectField
          id="language"
          label={t.languageLabel}
          hint={t.languageHint}
          value={language}
          options={LANGUAGES}
          onChange={setLanguage}
        />
      </Section>

      {/* Someone who only listens never has to see a film, and the other way round. */}
      <Section title={t.apps} scope="device">
        <SelectField
          id="apps"
          label={t.appsLabel}
          hint={t.appsHint}
          value={settings.apps}
          options={[
            { value: 'both', label: t.appsBoth },
            { value: 'watch', label: t.appsWatch },
            { value: 'listen', label: t.appsListen },
          ]}
          onChange={(apps) => update({ apps })}
        />
      </Section>

      <Section title={t.previewCards} scope="device">
        <SwitchField
          id="hover-preview"
          label={t.hoverPreviewLabel}
          hint={t.hoverPreviewHint}
          checked={settings.hoverPreview}
          onChange={(checked) => update({ hoverPreview: checked })}
        />
        <SelectField
          id="hover-delay"
          label={t.hoverDelayLabel}
          hint={t.hoverDelayHint}
          value={settings.hoverDelayMs}
          options={hoverDelays.some((option) => option.value === settings.hoverDelayMs) ? hoverDelays : [...hoverDelays, { value: settings.hoverDelayMs, label: `${settings.hoverDelayMs} ms` }]}
          onChange={(value) => update({ hoverDelayMs: value })}
          disabled={!settings.hoverPreview}
        />
      </Section>

      <Section title={t.motion} scope="device">
        <SwitchField
          id="page-animations"
          label={t.pageAnimationsLabel}
          hint={t.pageAnimationsHint}
          checked={settings.pageAnimations}
          onChange={(checked) => update({ pageAnimations: checked })}
        />
        <SwitchField
          id="smooth-scrolling"
          label={t.smoothScrollingLabel}
          hint={t.smoothScrollingHint}
          checked={settings.smoothScrolling}
          onChange={(checked) => update({ smoothScrolling: checked })}
        />
      </Section>
    </SettingsPage>
  )
}
