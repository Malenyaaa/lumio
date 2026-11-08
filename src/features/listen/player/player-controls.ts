import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'
import { useAuthedSession } from '@/features/auth/session'
import type { RemoteTarget } from '@/features/remote/remote-provider'
import { secondsToTicks, ticksToSeconds } from '@/lib/format'
import { currentTrack, music, useMusic, useMusicTime, type RepeatMode } from './music-player'

/**
 * What Listen's player bar shows and steers: this device's music player, or another device Lumio controls ("play
 * on"). The bar is the same either way; only where it gets its state and sends its commands differs.
 */
export interface PlayerControls {
  track: BaseItemDto | undefined
  playing: boolean
  buffering: boolean
  shuffle: boolean
  repeat: RepeatMode
  /** 0..1 */
  volume: number
  muted: boolean
  /** Seconds. */
  position: number
  duration: number
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  /** Set while controlling another device. */
  remote?: { name: string; disconnect: () => void }
}

export const PlayerControlsContext = createContext<PlayerControls | null>(null)

export function usePlayerControls(): PlayerControls {
  const controls = useContext(PlayerControlsContext)
  if (!controls) throw new Error('usePlayerControls must be used inside the player bar')
  return controls
}

/** This device's music player. */
export function useLocalControls(): PlayerControls {
  const state = useMusic()
  const { position, duration } = useMusicTime()
  return {
    track: currentTrack(state),
    playing: state.playing,
    buffering: state.buffering,
    shuffle: state.shuffle,
    repeat: state.repeat,
    volume: state.volume,
    muted: state.muted,
    position,
    duration,
    toggle: music.toggle,
    next: music.next,
    previous: music.previous,
    seek: music.seek,
    toggleShuffle: music.toggleShuffle,
    cycleRepeat: music.cycleRepeat,
    setVolume: music.setVolume,
    toggleMute: music.toggleMute,
  }
}

const POLL_MS = 2000
const REPEAT_TO_JELLYFIN: Record<RepeatMode, string> = { off: 'RepeatNone', all: 'RepeatAll', one: 'RepeatOne' }
const REPEAT_FROM_JELLYFIN: Record<string, RepeatMode> = { RepeatNone: 'off', RepeatAll: 'all', RepeatOne: 'one' }

/**
 * Another device: what plays there (asked every couple of seconds, the position moving on in between), and commands
 * sent there, applied here at once so the bar answers before the device reports back.
 */
export function useRemoteControls(target: RemoteTarget, disconnect: () => void): PlayerControls {
  const { api, session } = useAuthedSession()
  const sessions = useQuery({
    queryKey: ['remote-session', target.sessionId],
    refetchInterval: POLL_MS,
    queryFn: async () => (await getSessionApi(api).getSessions({ controllableByUserId: session.userId })).data,
  })
  const remote = sessions.data?.find((entry) => entry.Id === target.sessionId)
  const state = remote?.PlayState
  const track = remote?.NowPlayingItem
  const reportedAt = sessions.dataUpdatedAt
  // Changes sent but not reported back yet, shown right away (dropped once a newer report is in).
  const [pending, setPending] = useState<{ at: number; paused?: boolean; position?: number; volume?: number; muted?: boolean; shuffle?: boolean; repeat?: RepeatMode }>({ at: 0 })
  const fresh = pending.at > reportedAt ? pending : { at: 0 }
  const paused = fresh.paused ?? state?.IsPaused ?? true
  const duration = ticksToSeconds(track?.RunTimeTicks ?? 0)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (paused || !track) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [paused, track])
  const moved = (since: number) => (paused ? 0 : Math.max(0, now - since) / 1000)
  const base = fresh.position !== undefined ? fresh.position + moved(fresh.at) : ticksToSeconds(state?.PositionTicks ?? 0) + moved(reportedAt)
  const position = duration ? Math.min(base, duration) : base

  const commands = getSessionApi(api)
  const sessionId = target.sessionId
  const changed = (patch: Omit<typeof pending, 'at'>) => setPending((current) => ({ ...(current.at > reportedAt ? current : {}), ...patch, at: Date.now() }))
  const refresh = () => void sessions.refetch()
  const playstate = (command: 'PlayPause' | 'NextTrack' | 'PreviousTrack' | 'Seek', seekPositionTicks?: number) =>
    void commands.sendPlaystateCommand({ sessionId, command, seekPositionTicks }).then(refresh).catch(() => undefined)
  const general = (Name: string, Arguments: Record<string, string> = {}) =>
    void commands.sendFullGeneralCommand({ sessionId, generalCommand: { Name: Name as never, Arguments } }).then(refresh).catch(() => undefined)

  const shuffle = fresh.shuffle ?? state?.PlaybackOrder === 'Shuffle'
  const repeat = fresh.repeat ?? REPEAT_FROM_JELLYFIN[state?.RepeatMode ?? ''] ?? 'off'
  const volume = fresh.volume ?? (state?.VolumeLevel ?? 100) / 100
  const muted = fresh.muted ?? !!state?.IsMuted
  return {
    track,
    playing: !!track && !paused,
    buffering: sessions.isLoading,
    shuffle,
    repeat,
    volume,
    muted,
    position,
    duration,
    toggle: () => {
      changed({ paused: !paused, position })
      playstate('PlayPause')
    },
    next: () => playstate('NextTrack'),
    previous: () => playstate('PreviousTrack'),
    seek: (seconds) => {
      const clamped = Math.max(0, duration ? Math.min(seconds, duration) : seconds)
      changed({ position: clamped })
      setNow(Date.now())
      playstate('Seek', secondsToTicks(clamped))
    },
    toggleShuffle: () => {
      changed({ shuffle: !shuffle })
      general('SetShuffleQueue', { ShuffleMode: shuffle ? 'Sorted' : 'Shuffle' })
    },
    cycleRepeat: () => {
      const next: RepeatMode = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'
      changed({ repeat: next })
      general('SetRepeatMode', { RepeatMode: REPEAT_TO_JELLYFIN[next] })
    },
    setVolume: (level) => {
      changed({ volume: level, muted: false })
      general('SetVolume', { Volume: String(Math.round(level * 100)) })
    },
    toggleMute: () => {
      changed({ muted: !muted })
      general('ToggleMute')
    },
    remote: { name: target.name, disconnect },
  }
}
