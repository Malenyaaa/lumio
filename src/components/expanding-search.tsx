import { IconSearch, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { expandingSearchMessages } from '@/components/messages'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface ExpandingSearchProps {
  value: string
  onChange: (value: string) => void
  /** Accessible name and placeholder. */
  label: string
  placeholder?: string
  className?: string
}

/**
 * Search field that starts as an icon button and unfolds into an input, like the search in the header. It stays open
 * while it holds a term; emptied and left (or Escape), it folds back.
 */
export function ExpandingSearch({ value, onChange, label, placeholder, className }: ExpandingSearchProps) {
  const t = useMessages(expandingSearchMessages)
  const [opened, setOpened] = useState(false)
  const open = opened || value !== ''
  const input = useRef<HTMLInputElement>(null)
  // Focus only after the user unfolded it, not when it renders open because the URL already holds a term.
  const focusNext = useRef(false)

  useEffect(() => {
    if (open && focusNext.current) input.current?.focus()
    focusNext.current = false
  }, [open])

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        // As tall as the opened field (h-9), so opening it doesn't change the height of the row it sits in.
        className={cn('size-9', className)}
        onClick={() => {
          focusNext.current = true
          setOpened(true)
        }}
      >
        <IconSearch />
      </Button>
    )
  }

  const close = () => {
    onChange('')
    setOpened(false)
  }

  return (
    // flex: an inline input would sit on a text baseline and make the row a few pixels taller than the collapsed button,
    // pushing whatever follows (e.g. the history list) down when the field opens.
    <div className={cn('relative flex animate-page-in', className)}>
      <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={input}
        type="text"
        role="searchbox"
        aria-label={label}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          close()
        }}
        onBlur={() => !value && setOpened(false)}
        placeholder={placeholder ?? `${label} …`}
        className="h-9 w-52 rounded-lg border border-input bg-background/80 pl-8 pr-8 text-sm outline-none backdrop-blur focus-visible:border-foreground/35 focus-visible:bg-background sm:w-72"
      />
      <button
        type="button"
        aria-label={t.close}
        // Keep focus in the field until the click lands, so onBlur doesn't fold it away first.
        onPointerDown={(event) => event.preventDefault()}
        onClick={close}
        className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
      >
        <IconX className="size-4" />
      </button>
    </div>
  )
}
