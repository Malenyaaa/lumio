import { IconCast, IconCheck, IconDeviceLaptop } from '@tabler/icons-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppMode } from '@/lib/app-mode'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { browserName } from '@/lib/jellyfin'
import { DeviceList } from './device-list'
import { deviceMessages } from './messages'
import { useRemote } from './remote-provider'

/** Navbar button: pick the device Lumio should play on and control ("Abspielen auf"). */
export function DeviceMenu() {
  const t = useMessages(deviceMessages)
  const remote = useRemote()
  const listen = useAppMode() === 'listen'
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Connected to a device: the button says which, in the app's accent, so it is clear at a glance. */}
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size={remote.target ? 'sm' : 'icon'}
            aria-label={remote.target ? t.playOnDevice(remote.target.name) : t.playOn}
            title={remote.target ? t.playOnDevice(remote.target.name) : t.playOn}
            className={cn('relative', remote.target && (listen ? 'text-listen hover:text-listen' : 'text-primary hover:text-primary'))}
          />
        }
      >
        <IconCast />
        {remote.target && <span className="hidden max-w-32 truncate text-xs font-semibold sm:inline">{remote.target.name}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pb-1 pt-1 text-sm font-medium">{t.playOn}</p>
        {/* Same row layout as the other devices below. */}
        <button
          type="button"
          aria-pressed={!remote.target}
          onClick={() => {
            remote.setTarget(null)
            setOpen(false)
          }}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
        >
          <IconDeviceLaptop className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{t.thisDevice}</span>
            <span className="block truncate text-xs text-muted-foreground">Lumio · {browserName()}</span>
          </span>
          {!remote.target && <IconCheck className="size-4 shrink-0" />}
        </button>
        <div className="mx-2 my-1 border-t" />
        <DeviceList
          active={open}
          selectedSessionId={remote.target?.sessionId}
          onPick={(session) => {
            remote.setTarget({ sessionId: session.Id!, name: session.DeviceName ?? t.device })
            toast.success(t.controlling(session.DeviceName ?? t.device), { description: t.controllingHint })
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
