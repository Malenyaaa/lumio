import { IconCheck, IconZzz } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { setSleepTimer, useSleepTimer } from './sleep-timer'

const messages = defineMessages({
  de: {
    sleepTimer: 'Sleep-Timer',
    off: 'Aus',
    minutes: (n: number) => `${n} Minuten`,
    hour: '1 Stunde',
    endOfTrack: 'Ende des Titels',
    left: (n: number) => (n <= 1 ? 'Pausiert in unter einer Minute' : `Pausiert in ${n} Minuten`),
    atEnd: 'Pausiert am Ende des Titels',
  },
  en: {
    sleepTimer: 'Sleep timer',
    off: 'Off',
    minutes: (n: number) => `${n} minutes`,
    hour: '1 hour',
    endOfTrack: 'End of track',
    left: (n: number) => (n <= 1 ? 'Pauses in under a minute' : `Pauses in ${n} minutes`),
    atEnd: 'Pauses at the end of the track',
  },
})

const MINUTES = [5, 15, 30, 45, 60, 90]

/** Minutes left on the timer, updated while it runs. */
function useMinutesLeft(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!endsAt) return
    const tick = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(tick)
  }, [endsAt])
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 60_000)) : null
}

/** The player's moon button: pause after a while or at the end of the track. Lit while a timer runs. */
export function SleepTimerMenu({ className, iconClassName = 'size-4', activeClassName = 'text-listen' }: { className?: string; iconClassName?: string; activeClassName?: string }) {
  const t = useMessages(messages)
  const timer = useSleepTimer()
  const [open, setOpen] = useState(false)
  const left = useMinutesLeft(timer.endsAt)
  const active = timer.endsAt !== null || timer.endOfTrack
  const status = timer.endOfTrack ? t.atEnd : left !== null ? t.left(left) : null
  const options: Array<{ value: number | 'track' | null; label: string; selected: boolean }> = [
    { value: null, label: t.off, selected: !active },
    ...MINUTES.map((n) => ({ value: n, label: n === 60 ? t.hour : t.minutes(n), selected: false })),
    { value: 'track' as const, label: t.endOfTrack, selected: timer.endOfTrack },
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={status ?? t.sleepTimer}
        title={status ?? t.sleepTimer}
        aria-pressed={active}
        className={cn(
          'relative grid place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          active ? activeClassName : 'text-muted-foreground hover:text-foreground',
          className,
        )}
      >
        <IconZzz className={iconClassName} />
        {active && <span className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <p className="px-2 pt-1 text-sm font-medium">{t.sleepTimer}</p>
        {status && <p className="px-2 text-xs text-muted-foreground">{status}</p>}
        <div className="mt-1">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                setSleepTimer(option.value)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
            >
              {option.label}
              {option.selected && <IconCheck className="size-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
