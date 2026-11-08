import { IconChevronLeft, IconRotate } from '@tabler/icons-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_SYNCPLAY, useLocalSettings, type SyncPlaySettings } from '@/features/settings/local-settings'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const messages = defineMessages({
  de: {
    title: 'SyncPlay-Einstellungen',
    back: 'Zurück',
    correction: 'Synchronisierung korrigieren',
    correctionHint: 'Während der Wiedergabe Abweichungen zur Gruppe laufend ausgleichen.',
    speedToSync: 'SpeedToSync',
    speedToSyncHint: 'Kleine Abweichungen durch kurz schnelleres oder langsameres Abspielen aufholen.',
    speedMinDelay: 'Ab Abweichung',
    speedMaxDelay: 'Bis Abweichung',
    speedDuration: 'Dauer der Korrektur',
    skipToSync: 'SkipToSync',
    skipToSyncHint: 'Große Abweichungen durch einen Sprung an die richtige Stelle beheben.',
    skipMinDelay: 'Ab Abweichung',
    extraOffset: 'Zusätzlicher Zeitversatz',
    extraOffsetHint: 'Für Geräte mit Verzögerung bei der Ausgabe (z. B. Bluetooth-Kopfhörer). Positiv = früher.',
    reset: 'Standardwerte',
    ms: 'ms',
  },
  en: {
    title: 'SyncPlay settings',
    back: 'Back',
    correction: 'Sync correction',
    correctionHint: 'Keep evening out differences to the group while playing.',
    speedToSync: 'SpeedToSync',
    speedToSyncHint: 'Catch up small differences by playing slightly faster or slower for a moment.',
    speedMinDelay: 'From a difference of',
    speedMaxDelay: 'Up to a difference of',
    speedDuration: 'Correction length',
    skipToSync: 'SkipToSync',
    skipToSyncHint: 'Fix large differences by jumping to the right position.',
    skipMinDelay: 'From a difference of',
    extraOffset: 'Extra time offset',
    extraOffsetHint: 'For devices with output delay (e.g. Bluetooth headphones). Positive = earlier.',
    reset: 'Defaults',
    ms: 'ms',
  },
})

/** jellyfin-web's SyncPlay settings: how this device keeps itself in step with the group (stored per device). */
export function SyncPlaySettingsPanel({ onBack }: { onBack: () => void }) {
  const t = useMessages(messages)
  const { settings, update } = useLocalSettings()
  const sync = settings.syncPlay
  const set = (patch: Partial<SyncPlaySettings>) => update({ syncPlay: { ...sync, ...patch } })

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={t.back} onClick={onBack}>
          <IconChevronLeft />
        </Button>
        <p className="flex-1 text-sm font-medium">{t.title}</p>
        <Button variant="ghost" size="icon-sm" aria-label={t.reset} title={t.reset} onClick={() => update({ syncPlay: DEFAULT_SYNCPLAY })}>
          <IconRotate />
        </Button>
      </div>

      <Toggle label={t.correction} hint={t.correctionHint} checked={sync.correction} onChange={(correction) => set({ correction })} />

      <fieldset disabled={!sync.correction} className="space-y-3 disabled:opacity-50">
        <Toggle label={t.speedToSync} hint={t.speedToSyncHint} checked={sync.speedToSync} onChange={(speedToSync) => set({ speedToSync })} />
        {sync.speedToSync && (
          <div className="grid gap-2 pl-3">
            <Milliseconds label={t.speedMinDelay} unit={t.ms} value={sync.speedMinDelay} onChange={(speedMinDelay) => set({ speedMinDelay })} />
            <Milliseconds label={t.speedMaxDelay} unit={t.ms} value={sync.speedMaxDelay} onChange={(speedMaxDelay) => set({ speedMaxDelay })} />
            <Milliseconds label={t.speedDuration} unit={t.ms} value={sync.speedDuration} onChange={(speedDuration) => set({ speedDuration })} />
          </div>
        )}
        <Toggle label={t.skipToSync} hint={t.skipToSyncHint} checked={sync.skipToSync} onChange={(skipToSync) => set({ skipToSync })} />
        {sync.skipToSync && (
          <div className="grid gap-2 pl-3">
            <Milliseconds label={t.skipMinDelay} unit={t.ms} value={sync.skipMinDelay} onChange={(skipMinDelay) => set({ skipMinDelay })} />
          </div>
        )}
      </fieldset>

      <div className="space-y-1 border-t pt-3">
        <Milliseconds label={t.extraOffset} unit={t.ms} value={sync.extraOffset} allowNegative onChange={(extraOffset) => set({ extraOffset })} />
        <p className="text-xs text-muted-foreground">{t.extraOffsetHint}</p>
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className={cn('mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-primary' : 'bg-input')}>
        <span className={cn('size-4 rounded-full shadow transition-transform', checked ? 'translate-x-4 bg-primary-foreground' : 'bg-background')} />
      </span>
    </button>
  )
}

/** A number of milliseconds; typed freely, applied once it is a valid number. */
function Milliseconds({ label, unit, value, onChange, allowNegative }: { label: string; unit: string; value: number; onChange: (value: number) => void; allowNegative?: boolean }) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(String(value))
  }
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <Input
          inputMode="numeric"
          value={text}
          className="h-7 w-20 text-right tabular-nums"
          onChange={(event) => {
            setText(event.target.value)
            const number = Number(event.target.value)
            if (event.target.value.trim() !== '' && Number.isFinite(number) && (allowNegative || number >= 0)) onChange(Math.round(number))
          }}
          onBlur={() => setText(String(value))}
        />
        <span className="w-5 text-xs text-muted-foreground">{unit}</span>
      </span>
    </label>
  )
}
