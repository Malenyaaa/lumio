import { IconCast, IconUsersGroup } from '@tabler/icons-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { messagesFor, useMessages } from '@/lib/i18n'
import { handoffMessages } from './messages'
import { useRemote, type RemoteTarget } from './remote-provider'

interface HandoffProps {
  id: string
  ticks: number
  audio?: number
  subtitle?: number
}

/** Where the player just stopped, per item, so a handoff from inside a running player continues from there. */
const stoppedAt = new Map<string, { ticks: number; at: number }>()
/** Only a position left moments ago counts; older ones belong to an earlier visit. */
const FRESH_MS = 3000

/** Called by the player when it stops; a handoff that replaces it right away picks the position up. */
export function rememberStopPosition(id: string, ticks: number) {
  stoppedAt.set(id, { ticks, at: Date.now() })
}

function startTicks(id: string, fallback: number) {
  const entry = stoppedAt.get(id)
  stoppedAt.delete(id)
  return entry && Date.now() - entry.at < FRESH_MS ? entry.ticks : fallback
}

/** Leaves the player route we only passed through; opened directly (no history) it falls back to the detail page. */
function useLeave(id: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => void (location.key === 'default' ? navigate(`/item/${id}`, { replace: true }) : navigate(-1))
}

function Message({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-black text-white">
      <div className="flex flex-col items-center gap-3 text-center">
        {icon}
        <p className="text-sm text-white/80">{children}</p>
      </div>
    </div>
  )
}

/**
 * Shown instead of the player while Lumio controls another device: sends the title there, then returns to where the
 * user came from. The request goes out after leaving, so a quick back navigation can't race the group/remote update.
 */
export function RemoteHandoff({ id, ticks, audio, subtitle, target }: HandoffProps & { target: RemoteTarget }) {
  const t = useMessages(handoffMessages)
  const remote = useRemote()
  const leave = useLeave(id)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    leave()
    remote
      .playOn(target.sessionId, [id], startTicks(id, ticks) || undefined, { audio, subtitle })
      .then(() => toast.success(messagesFor(handoffMessages).playingOn(target.name)))
      .catch(() => {
        toast.error(messagesFor(handoffMessages).unreachable(target.name))
        remote.setTarget(null)
      })
    // Runs once per visit; the guard above makes extra renders harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Message icon={<IconCast className="size-8" />}>{t.sending(target.name)}</Message>
}

/** Shown instead of the player while in a SyncPlay group: the group's queue is set, then everyone (including us) opens it. */
export function SyncPlayHandoff({ id, ticks }: HandoffProps) {
  const t = useMessages(handoffMessages)
  const remote = useRemote()
  const leave = useLeave(id)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    leave()
    remote.syncRequests.setQueue(id, startTicks(id, ticks)).catch(() => toast.error(messagesFor(handoffMessages).groupFailed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Message icon={<IconUsersGroup className="size-8" />}>{t.groupStarting}</Message>
}
