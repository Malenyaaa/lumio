import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { codeInputMessages } from '@/components/messages'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  /** Called once every box is filled (typed or pasted). */
  onComplete?: (value: string) => void
  length?: number
  label: string
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
}

/**
 * One box per digit, as for one-time codes: typing moves on, Backspace moves back, arrow keys move freely and pasting
 * a whole code fills all boxes.
 */
export function CodeInput({ value, onChange, onComplete, length = 6, label, disabled, invalid, autoFocus }: CodeInputProps) {
  const t = useMessages(codeInputMessages)
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  // The code as of the latest keystroke. Moving focus happens right after a change, before React re-renders with the
  // new value; the focus handler must not judge "is this box past the end?" by the old, shorter value, or it sends the
  // cursor back into the box just typed into.
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])
  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  const focus = (index: number) => {
    const box = boxes.current[Math.min(Math.max(index, 0), length - 1)]
    box?.focus()
    box?.select()
  }

  /** Writes digits starting at `index` and returns where the cursor should go next. */
  const write = (index: number, input: string) => {
    const incoming = input.replace(/\D/g, '')
    if (!incoming) return index
    const next = [...digits]
    for (let i = 0; i < incoming.length && index + i < length; i++) next[index + i] = incoming[i]!
    // Keep the code contiguous: a digit typed into a later box while earlier ones are empty moves forward.
    const joined = next.join('').slice(0, length)
    latest.current = joined
    onChange(joined)
    if (joined.length === length) onComplete?.(joined)
    return index + incoming.length
  }

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index]) {
        latest.current = value.slice(0, index) + value.slice(index + 1)
        onChange(latest.current)
      } else if (index > 0) {
        latest.current = value.slice(0, index - 1) + value.slice(index)
        onChange(latest.current)
        focus(index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focus(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focus(index + 1)
    }
  }

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    focus(write(index, event.clipboardData.getData('text')))
  }

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element
          }}
          // The first box gets the one-time-code hint, so phones can offer the code from a message.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          inputMode="numeric"
          aria-label={t.digit(index + 1, length)}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          value={digit}
          // Clicking a box past the typed code lands in the first empty one.
          onFocus={(event) => {
            if (index > latest.current.length) focus(latest.current.length)
            else event.currentTarget.select()
          }}
          onChange={(event) => {
            // The box may already hold a digit; the new one is whatever differs from it.
            const typed = event.target.value.replace(digit, '') || event.target.value
            focus(write(Math.min(index, value.length), typed))
          }}
          onKeyDown={onKeyDown(index)}
          onPaste={onPaste(index)}
          className={cn(
            'size-11 rounded-lg border border-input bg-background/60 text-center font-mono text-xl font-semibold caret-transparent outline-none transition-all sm:size-12 sm:text-2xl',
            'focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50',
            digit && 'border-foreground/30',
            invalid && 'border-destructive ring-destructive/20 animate-shake',
          )}
        />
      ))}
    </div>
  )
}
