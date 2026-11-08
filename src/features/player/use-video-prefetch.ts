import { ItemFields, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api'
import { useEffect } from 'react'
import { useAuthedSession } from '@/features/auth/session'
import { useLocalSettings } from '@/features/settings/local-settings'
import { downloadVideo, videoCacheAvailable } from './video-cache'

const MBIT = 1_000_000
const GB = 1024 * 1024 * 1024

/**
 * While an episode plays, its next episodes (as many as set) are downloaded into the video cache one after another,
 * so they start at once and play offline. Starts once the episode is under way, to leave the start its bandwidth.
 */
export function useVideoPrefetch(item: BaseItemDto | undefined, active: boolean) {
  const { api, session } = useAuthedSession()
  const { settings } = useLocalSettings()
  const count = settings.videoPrefetch
  const seriesId = item?.Type === 'Episode' ? item.SeriesId : undefined
  const itemId = item?.Id

  useEffect(() => {
    if (!active || !count || !seriesId || !itemId || !videoCacheAvailable) return
    let cancelled = false
    void (async () => {
      const episodes =
        (
          await getShowApi(api)
            .getEpisodes({ seriesId, userId: session.userId, startItemId: itemId, limit: count + 1, fields: [ItemFields.MediaSources, ItemFields.MediaStreams] })
            .catch(() => null)
        )?.data.Items ?? []
      for (const episode of episodes.filter((entry) => entry.Id !== itemId).slice(0, count)) {
        if (cancelled) return
        await downloadVideo(api, session, episode, { maxBytes: settings.videoCacheGb * GB, bitrate: settings.videoBitrateMbit * MBIT })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active, count, seriesId, itemId, api, session, settings.videoCacheGb, settings.videoBitrateMbit])
}
