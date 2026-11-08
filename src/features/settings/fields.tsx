import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { fieldMessages } from './messages'

export function SettingsPage({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </div>
  )
}

interface SectionProps {
  title: string
  description?: string
  /** Where the settings are stored: with the Jellyfin account (all apps) or only on this device. */
  scope?: 'account' | 'device'
  children: ReactNode
}

export function Section({ title, description, scope, children }: SectionProps) {
  const t = useMessages(fieldMessages)
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {scope && <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{scope === 'account' ? t.scopeAccount : t.scopeDevice}</span>}
      </div>
      <div className="divide-y rounded-xl border bg-card">{children}</div>
    </section>
  )
}

/** Placeholder while account settings load; if loading failed, says so and offers a retry instead of spinning forever. */
export function SettingsPending({ error, onRetry, rows = 3 }: { error: boolean; onRetry: () => void; rows?: number }) {
  const t = useMessages(fieldMessages)
  if (error) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm">{t.loadFailed}</p>
        <Button variant="outline" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

/** Ids that tie a row's label and hint to its control (for screen readers and click-to-focus). */
const labelId = (id: string) => `${id}-label`
const hintId = (id: string) => `${id}-hint`
const describedBy = (id: string, hint?: string) => (hint ? hintId(id) : undefined)

interface RowProps {
  label: string
  hint?: string
  /** Id of the control; the label points at it and the hint gets a derived id. */
  htmlFor?: string
  children: ReactNode
}

/** Label and explanation on the left, the control on the right (stacked on narrow screens). */
export function Row({ label, hint, htmlFor, children }: RowProps) {
  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <label id={htmlFor && labelId(htmlFor)} htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && (
          <p id={htmlFor && hintId(htmlFor)} className="max-w-prose text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <div className="shrink-0 sm:w-72">{children}</div>
    </div>
  )
}

/** Adds the stored value to a list of options if it is missing, so an unknown value isn't silently shown as another one. */
export function withCurrent(options: Array<{ value: string; label: string }>, current: string) {
  return options.some((option) => option.value === current) ? options : [...options, { value: current, label: current }]
}

interface SelectFieldProps<T extends string | number> {
  id: string
  label: string
  hint?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}

/** Dropdown built on the app's own Select (no browser-native popup); values may be numbers or strings. */
export function SelectField<T extends string | number>({ id, label, hint, value, options, onChange, disabled }: SelectFieldProps<T>) {
  const items = options.map((option) => ({ value: String(option.value), label: option.label }))
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <Select
        value={String(value)}
        items={items}
        disabled={disabled}
        onValueChange={(picked) => {
          const match = options.find((option) => String(option.value) === picked)
          if (match) onChange(match.value)
        }}
      >
        <SelectTrigger id={id} aria-describedby={describedBy(id, hint)} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  )
}

interface SliderFieldProps {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function SliderField({ id, label, hint, value, min, max, step = 1, onChange, disabled }: SliderFieldProps) {
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <div className="flex items-center gap-3">
        <Slider
          id={id}
          // The slider root is a <div>, so the <label for> doesn't reach it; name the thumb explicitly.
          aria-labelledby={labelId(id)}
          aria-describedby={describedBy(id, hint)}
          min={min}
          max={max}
          step={step}
          value={[value]}
          disabled={disabled}
          onValueChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? value) : next)}
        />
        <span className="w-8 text-right text-sm tabular-nums" aria-hidden>
          {value}
        </span>
      </div>
    </Row>
  )
}

const HEX = /^#[0-9a-f]{6}$/i

interface ColorFieldProps {
  id: string
  label: string
  hint?: string
  value: string
  swatches: Array<{ value: string; name: string }>
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Color choice from a few swatches plus a hex field for anything else; replaces the browser's color dialog.
 * The swatches behave like a radio group: one tab stop, arrow keys move the selection.
 */
export function ColorField({ id, label, hint, value, swatches, onChange, disabled }: ColorFieldProps) {
  // While typing, the draft may be incomplete; it only becomes the value once it is a valid #rrggbb.
  const t = useMessages(fieldMessages)
  const [draft, setDraft] = useState<string | null>(null)
  const group = useRef<HTMLDivElement>(null)
  const selectedIndex = swatches.findIndex((swatch) => swatch.value.toLowerCase() === value.toLowerCase())

  const pick = (index: number, focus: boolean) => {
    const swatch = swatches[(index + swatches.length) % swatches.length]!
    setDraft(null)
    onChange(swatch.value)
    if (focus) group.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[swatches.indexOf(swatch)]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const from = Math.max(selectedIndex, 0)
    const moves: Record<string, number> = { ArrowRight: from + 1, ArrowDown: from + 1, ArrowLeft: from - 1, ArrowUp: from - 1, Home: 0, End: swatches.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    pick(moves[event.key]!, true)
  }

  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <div ref={group} role="radiogroup" aria-labelledby={labelId(id)} onKeyDown={onKeyDown} className="flex flex-wrap gap-1.5">
          {swatches.map((swatch, index) => {
            const checked = index === selectedIndex
            return (
              <button
                key={swatch.value}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={swatch.name}
                title={swatch.name}
                // Roving tab stop: the selected swatch (or the first one if a custom color is set).
                tabIndex={checked || (selectedIndex < 0 && index === 0) ? 0 : -1}
                disabled={disabled}
                onClick={() => pick(index, false)}
                style={{ backgroundColor: swatch.value }}
                className={cn(
                  'size-6 rounded-full border border-white/20 outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
                  checked && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                )}
              />
            )
          })}
        </div>
        <Input
          id={id}
          value={draft ?? value}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          aria-label={t.hexValue(label)}
          aria-describedby={describedBy(id, hint)}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            if (HEX.test(next)) onChange(next.toLowerCase())
          }}
          onBlur={() => setDraft(null)}
          className="h-8 w-24 font-mono text-xs"
        />
      </div>
    </Row>
  )
}

interface SwitchFieldProps {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function SwitchField({ id, label, hint, checked, onChange, disabled }: SwitchFieldProps) {
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <div className="flex sm:justify-end">
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={describedBy(id, hint)}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            // Flex-centered with padding (no border, no absolute offsets) so the knob sits exactly in the middle.
            'inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
            checked ? 'bg-primary' : 'bg-input',
          )}
        >
          <span
            className={cn(
              'size-5 rounded-full shadow transition-transform',
              checked ? 'translate-x-5 bg-primary-foreground' : 'bg-background',
            )}
          />
        </button>
      </div>
    </Row>
  )
}
