import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useOffline } from '@/lib/network'
import { useAudioCacheStats } from './player/audio-cache'
import { useDownloadStats } from './player/downloads'
import { playableOffline } from './player/music-player'

/**
 * Whether a song can't play right now: offline (or the server unreachable), and neither downloaded nor in the cache.
 * Lists grey such songs out; the player skips them. Cached songs carry no download mark but still play.
 */
export function useUnavailable(item: BaseItemDto | undefined) {
  const offline = useOffline()
  // Re-checked when the cache or the downloads change.
  useAudioCacheStats()
  useDownloadStats()
  return offline && !!item && !playableOffline(item)
}
