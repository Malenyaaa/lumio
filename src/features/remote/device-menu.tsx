import { IconCast, IconCheck, IconDeviceLaptop } from '@tabler/icons-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useMessages } from '@/lib/i18n'
import { browserName } from '@/lib/jellyfin'
import { DeviceList } from './device-list'
import { deviceMessages } from './messages'
import { useRemote } from './remote-provider'

/** Navbar button: pick the device Lumio should play on and control ("Abspielen auf"). */
export function DeviceMenu() {
  const t = useMessages(deviceMessages)
  const remote = useRemote()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={remote.target ? t.playOnDevice(remote.target.name) : t.playOn} title={t.playOn} className="relative" />}>
        <IconCast />
        {remote.target && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />}
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
