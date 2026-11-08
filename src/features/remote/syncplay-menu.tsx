import { getSyncPlayApi } from '@jellyfin/sdk/lib/utils/api/sync-play-api'
import { IconLoader2, IconSettings, IconUser, IconUsersGroup } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuthedSession } from '@/features/auth/session'
import { messagesFor, useMessages } from '@/lib/i18n'
import { syncPlayMessages } from './messages'
import { useRemote } from './remote-provider'
import { SyncPlaySettingsPanel } from './syncplay-settings'

// Labelled by `syncPlayMessages` under the same key; unknown states are shown as the server sends them.
const GROUP_STATES = ['Idle', 'Waiting', 'Paused', 'Playing'] as const
type GroupState = (typeof GROUP_STATES)[number]

/** Navbar button for SyncPlay: join or create a watch-together group, see who is in it, leave it. */
export function SyncPlayMenu() {
  const t = useMessages(syncPlayMessages)
  const remote = useRemote()
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const group = remote.group
  const openSettings = () => setShowSettings(true)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setShowSettings(false)
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={group ? t.group(group.GroupName ?? '') : t.joinAGroup} title={t.watchTogether} className="relative" />}>
        <IconUsersGroup />
        {group && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        {showSettings ? (
          <SyncPlaySettingsPanel onBack={() => setShowSettings(false)} />
        ) : group ? (
          <CurrentGroup onLeft={() => setOpen(false)} onSettings={openSettings} />
        ) : (
          <GroupBrowser active={open} onJoined={() => setOpen(false)} onSettings={openSettings} />
        )}
      </PopoverContent>
    </Popover>
  )
}

function CurrentGroup({ onLeft, onSettings }: { onLeft: () => void; onSettings: () => void }) {
  const t = useMessages(syncPlayMessages)
  const remote = useRemote()
  const group = remote.group!
  const leave = useMutation({ mutationFn: () => remote.leaveGroup(), onSuccess: onLeft, onError: () => toast.error(messagesFor(syncPlayMessages).leaveFailed) })

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{group.GroupName}</p>
          <p className="text-xs text-muted-foreground">{GROUP_STATES.includes(group.State as GroupState) ? t[group.State as GroupState] : group.State} · {t.watchingTogether}</p>
        </div>
        <SettingsButton onClick={onSettings} />
      </div>
      <ul className="grid gap-1">
        {(group.Participants ?? []).map((name) => (
          <li key={name} className="flex items-center gap-2 text-sm">
            <IconUser className="size-4 text-muted-foreground" />
            {name}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      <Button variant="outline" className="w-full" disabled={leave.isPending} onClick={() => leave.mutate()}>
        {t.leave}
      </Button>
    </div>
  )
}

function GroupBrowser({ active, onJoined, onSettings }: { active: boolean; onJoined: () => void; onSettings: () => void }) {
  const { api } = useAuthedSession()
  const t = useMessages(syncPlayMessages)
  const remote = useRemote()
  const [name, setName] = useState('')

  const groups = useQuery({
    queryKey: ['syncplay-groups'],
    enabled: active,
    refetchInterval: active ? 5000 : false,
    queryFn: async () => (await getSyncPlayApi(api).syncPlayGetGroups()).data,
  })
  const join = useMutation({
    mutationFn: (groupId: string) => remote.joinGroup(groupId),
    onSuccess: onJoined,
    onError: () => toast.error(messagesFor(syncPlayMessages).joinFailed),
  })
  const create = useMutation({
    mutationFn: (groupName: string) => remote.createGroup(groupName),
    onSuccess: onJoined,
    onError: () => toast.error(messagesFor(syncPlayMessages).createFailed),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim()) create.mutate(name.trim())
  }

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-medium">{t.watchTogether}</p>
        <SettingsButton onClick={onSettings} />
      </div>

      {groups.isLoading && (
        <div className="grid place-items-center py-4 text-muted-foreground">
          <IconLoader2 className="size-5 animate-spin" />
        </div>
      )}
      {groups.isSuccess && groups.data.length === 0 && <p className="text-sm text-muted-foreground">{t.noGroups}</p>}
      <ul className="grid gap-0.5">
        {groups.data?.map((entry) => (
          <li key={entry.GroupId}>
            <button
              type="button"
              aria-label={t.joinGroup(entry.GroupName ?? '')}
              disabled={join.isPending}
              onClick={() => join.mutate(entry.GroupId!)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
            >
              <IconUsersGroup className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{entry.GroupName}</span>
                <span className="block truncate text-xs text-muted-foreground">{(entry.Participants ?? []).join(', ') || t.empty}</span>
              </span>
              <span className="text-xs text-muted-foreground">{t.join}</span>
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="flex gap-2 border-t pt-3">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.newGroup} aria-label={t.newGroupName} maxLength={60} />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {t.create}
        </Button>
      </form>
    </div>
  )
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  const t = useMessages(syncPlayMessages)
  return (
    <Button variant="ghost" size="icon-sm" aria-label={t.settings} title={t.settings} onClick={onClick}>
      <IconSettings />
    </Button>
  )
}
