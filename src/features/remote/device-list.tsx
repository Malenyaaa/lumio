import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconCheck, IconDeviceDesktop, IconDeviceMobile, IconDeviceTv, IconLoader2 } from '@tabler/icons-react'
import { useAuthedSession } from '@/features/auth/session'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { deviceMessages } from './messages'
import { useControllableSessions } from './use-controllable-sessions'

function DeviceIcon({ session }: { session: SessionInfoDto }) {
  const hint = `${session.Client ?? ''} ${session.DeviceName ?? ''}`
  if (/tv|kodi|roku|fire|chromecast|cast/i.test(hint)) return <IconDeviceTv className="size-5 shrink-0" />
  if (/android|ios|iphone|ipad|mobile|phone/i.test(hint)) return <IconDeviceMobile className="size-5 shrink-0" />
  return <IconDeviceDesktop className="size-5 shrink-0" />
}

interface DeviceListProps {
  /** Poll for devices only while the list is on screen. */
  active: boolean
  selectedSessionId?: string
  onPick: (session: SessionInfoDto) => void
  /** Class for the picked/hover row colors, so the list fits dark overlays as well as popovers. */
  rowClassName?: string
}

/** The devices a title can be sent to, with what each one is playing right now. */
export function DeviceList({ active, selectedSessionId, onPick, rowClassName }: DeviceListProps) {
  const t = useMessages(deviceMessages)
  const { session } = useAuthedSession()
  const sessions = useControllableSessions(active)

  if (sessions.isLoading) {
    return (
      <div className="grid place-items-center py-6 text-muted-foreground">
        <IconLoader2 className="size-5 animate-spin" />
      </div>
    )
  }
  if (!sessions.data?.length) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        {t.noDevices}
      </p>
    )
  }

  // Admins may also play on other users' devices: those come after one's own, each saying whose it is.
  const own = sessions.data.filter((entry) => entry.UserId === session.userId)
  const others = sessions.data.filter((entry) => entry.UserId !== session.userId)

  const row = (entry: SessionInfoDto) => {
    const playing = entry.NowPlayingItem
    const selected = entry.Id === selectedSessionId
    const owner = entry.UserId !== session.userId ? entry.UserName : undefined
    return (
      <li key={entry.Id}>
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onPick(entry)}
          className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted', rowClassName)}
        >
          <DeviceIcon session={entry} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{entry.DeviceName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {owner && <span className="font-medium text-foreground/80">{owner} · </span>}
              {playing ? t.playing(playing.Name ?? '') : entry.Client}
            </span>
          </span>
          {selected && <IconCheck className="size-4 shrink-0" />}
        </button>
      </li>
    )
  }

  return (
    <div className="grid gap-2">
      {own.length > 0 && <ul className="grid gap-0.5">{own.map(row)}</ul>}
      {others.length > 0 && (
        <div className="grid gap-0.5">
          <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">{t.othersDevices}</p>
          <ul className="grid gap-0.5">{others.map(row)}</ul>
        </div>
      )}
    </div>
  )
}
