import { SubtitlePlaybackMode } from '@jellyfin/sdk/lib/generated-client/models'
import type { CSSProperties } from 'react'
import { ColorField, Section, SelectField, SettingsPage, SettingsPending, SliderField, withCurrent } from './fields'
import {
  subtitleCssVars,
  useLocalSettings,
  type LocalSettings,
  type SubtitleFont,
  type SubtitleShadow,
  type SubtitleSize,
} from './local-settings'
import { useMessages } from '@/lib/i18n'
import { subtitlesMessages } from './messages'
import { useLanguageOptions } from './use-languages'
import { useUpdateConfiguration, useUserConfiguration } from './use-user-configuration'

type SubtitlesTexts = (typeof subtitlesMessages)['de']
type SubtitlesMessage = { [K in keyof SubtitlesTexts]: SubtitlesTexts[K] extends string ? K : never }[keyof SubtitlesTexts]

// Message keys of the option labels (the shown texts live in messages.ts).
const MODES: Array<{ value: SubtitlePlaybackMode; label: SubtitlesMessage; hint: SubtitlesMessage }> = [
  { value: SubtitlePlaybackMode.Default, label: 'modeDefault', hint: 'modeDefaultHint' },
  { value: SubtitlePlaybackMode.Smart, label: 'modeSmart', hint: 'modeSmartHint' },
  { value: SubtitlePlaybackMode.OnlyForced, label: 'modeOnlyForced', hint: 'modeOnlyForcedHint' },
  { value: SubtitlePlaybackMode.Always, label: 'modeAlways', hint: 'modeAlwaysHint' },
  { value: SubtitlePlaybackMode.None, label: 'modeNone', hint: 'modeNoneHint' },
]

const SIZES: Array<{ value: SubtitleSize; label: SubtitlesMessage }> = [
  { value: 'smaller', label: 'sizeSmaller' },
  { value: 'small', label: 'sizeSmall' },
  { value: 'normal', label: 'sizeNormal' },
  { value: 'large', label: 'sizeLarge' },
  { value: 'larger', label: 'sizeLarger' },
  { value: 'extralarge', label: 'sizeExtralarge' },
]

const FONTS: Array<{ value: SubtitleFont; label: SubtitlesMessage }> = [
  { value: 'default', label: 'fontDefault' },
  { value: 'typewriter', label: 'fontTypewriter' },
  { value: 'print', label: 'fontPrint' },
  { value: 'console', label: 'fontConsole' },
  { value: 'cursive', label: 'fontCursive' },
  { value: 'casual', label: 'fontCasual' },
  { value: 'smallcaps', label: 'fontSmallcaps' },
]

const SHADOWS: Array<{ value: SubtitleShadow; label: SubtitlesMessage }> = [
  { value: 'none', label: 'shadowNone' },
  { value: 'raised', label: 'shadowRaised' },
  { value: 'depressed', label: 'shadowDepressed' },
  { value: 'uniform', label: 'shadowUniform' },
  { value: 'dropshadow', label: 'shadowDropshadow' },
]

const COLOR_SWATCHES: Array<{ value: string; name: SubtitlesMessage }> = [
  { value: '#ffffff', name: 'white' },
  { value: '#ffe066', name: 'yellow' },
  { value: '#7ee0ff', name: 'lightBlue' },
  { value: '#8dff8d', name: 'lightGreen' },
  { value: '#ff9bd2', name: 'pink' },
  { value: '#ffb066', name: 'orange' },
  { value: '#b3b3b3', name: 'gray' },
  { value: '#000000', name: 'black' },
]

/** Puts the texts of the active language into an option list. */
function localize<T extends { label: SubtitlesMessage }>(options: T[], t: SubtitlesTexts) {
  return options.map((option) => ({ ...option, label: t[option.label] }))
}

/** Same look as `video::cue`, so the preview matches what the player will draw. */
const previewTextStyle: CSSProperties = {
  color: 'var(--sub-color, #fff)',
  fontFamily: 'var(--sub-family, inherit)',
  fontSize: 'var(--sub-size, 1.5rem)',
  fontWeight: 'var(--sub-weight, 400)',
  fontVariant: 'var(--sub-variant, normal)',
  textShadow: 'var(--sub-shadow, none)',
  background: 'rgb(0 0 0 / 0.65)',
  lineHeight: 1.35,
}

const LINE_HEIGHT_REM = 2

function SubtitlePreview({ settings }: { settings: LocalSettings }) {
  const line = settings.subtitleLine
  // Like WebVTT: 0 is the top line and counts downwards, -1 is the bottom line and negative numbers count upwards.
  const t = useMessages(subtitlesMessages)
  const position: CSSProperties = line < 0 ? { bottom: `${(-line - 1) * LINE_HEIGHT_REM + 0.5}rem` } : { top: `${line * LINE_HEIGHT_REM + 0.5}rem` }

  return (
    <div
      role="img"
      aria-label={t.previewLabel}
      style={subtitleCssVars(settings)}
      className="relative h-44 overflow-hidden rounded-xl border bg-linear-to-br from-slate-600 via-slate-800 to-slate-950"
    >
      <p className="absolute inset-x-0 mx-auto w-fit max-w-[90%] px-2 text-center" style={{ ...previewTextStyle, ...position }}>
        {t.previewText}
      </p>
    </div>
  )
}

export function SubtitlesPage() {
  const user = useUserConfiguration()
  const config = user.data?.Configuration
  const save = useUpdateConfiguration()
  const languages = useLanguageOptions()
  const { settings, update } = useLocalSettings()
  const t = useMessages(subtitlesMessages)

  if (!config) {
    return (
      <SettingsPage title={t.title}>
        <SettingsPending error={user.isError} onRetry={() => void user.refetch()} />
      </SettingsPage>
    )
  }

  const language = config.SubtitleLanguagePreference ?? ''
  const languageOptions = withCurrent(languages, language)
  const mode = config.SubtitleMode ?? SubtitlePlaybackMode.Default
  const custom = settings.subtitleStyle === 'custom'

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.selection} scope="account">
        <SelectField
          id="subtitle-language"
          label={t.languageLabel}
          value={language}
          options={languageOptions}
          onChange={(value) => save.mutate({ SubtitleLanguagePreference: value || null })}
        />
        <SelectField
          id="subtitle-mode"
          label={t.modeLabel}
          hint={t[MODES.find((entry) => entry.value === mode)?.hint ?? 'modeDefaultHint']}
          value={mode}
          options={localize(MODES, t)}
          onChange={(value) => save.mutate({ SubtitleMode: value })}
        />
      </Section>

      <Section
        title={t.appearance}
        description={t.appearanceDescription}
        scope="account"
      >
        <SelectField
          id="subtitle-style"
          label={t.styleLabel}
          hint={custom ? t.styleCustomHint : t.styleNativeHint}
          value={settings.subtitleStyle}
          options={[
            { value: 'custom', label: t.styleCustom },
            { value: 'native', label: t.styleNative },
          ]}
          onChange={(value) => update({ subtitleStyle: value })}
        />
        <SelectField id="subtitle-size" label={t.sizeLabel} value={settings.subtitleSize} options={localize(SIZES, t)} disabled={!custom} onChange={(value) => update({ subtitleSize: value })} />
        <SelectField
          id="subtitle-weight"
          label={t.weightLabel}
          value={settings.subtitleWeight}
          options={[
            { value: 'normal', label: t.weightNormal },
            { value: 'bold', label: t.weightBold },
          ]}
          disabled={!custom}
          onChange={(value) => update({ subtitleWeight: value })}
        />
        <SelectField id="subtitle-font" label={t.fontLabel} value={settings.subtitleFont} options={localize(FONTS, t)} disabled={!custom} onChange={(value) => update({ subtitleFont: value })} />
        <ColorField
          id="subtitle-color"
          label={t.colorLabel}
          value={settings.subtitleColor}
          swatches={COLOR_SWATCHES.map((swatch) => ({ ...swatch, name: t[swatch.name] }))}
          disabled={!custom}
          onChange={(value) => update({ subtitleColor: value })}
        />
        <SelectField
          id="subtitle-shadow"
          label={t.shadowLabel}
          value={settings.subtitleShadow}
          options={localize(SHADOWS, t)}
          disabled={!custom}
          onChange={(value) => update({ subtitleShadow: value })}
        />
        <SliderField
          id="subtitle-line"
          label={t.lineLabel}
          hint={t.lineHint}
          value={settings.subtitleLine}
          min={-10}
          max={10}
          disabled={!custom}
          onChange={(value) => update({ subtitleLine: value })}
        />
      </Section>

      <SubtitlePreview settings={settings} />
    </SettingsPage>
  )
}
