import { IconCoffee } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/lib/i18n'
import { breakMessages } from './messages'

/** Shown over the paused video once the break reminder is due (see watch-timers): go on, or leave the player. */
export function BreakReminder({ minutes, onResume, onLeave }: { minutes: number; onResume: () => void; onLeave: () => void }) {
  const t = useMessages(breakMessages)
  return (
    <div
      role="alertdialog"
      aria-labelledby="break-title"
      className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-6 backdrop-blur-sm animate-in fade-in-0 duration-500"
      // Taps here belong to the dialog, not to the picture behind it.
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center text-white">
        <IconCoffee className="size-10 text-white/80" />
        <h2 id="break-title" className="text-xl font-semibold">
          {t.title}
        </h2>
        <p className="text-sm text-white/75">{t.body(t.hours(minutes))}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button autoFocus onClick={onResume}>
            {t.resume}
          </Button>
          <Button variant="outline" onClick={onLeave}>
            {t.leave}
          </Button>
        </div>
      </div>
    </div>
  )
}
