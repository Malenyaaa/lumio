import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuthedSession } from '@/features/auth/session'
import { itemOptions } from '@/features/items/queries'
import { useLocalSettings } from '@/features/settings/local-settings'
import { secondsToTicks } from '@/lib/format'
import { initialChoice, playbackOptions } from './playback'
import { segmentsOptions, startAfterIntro } from './segments'

/** How long a prepared stream stays usable; long enough for an outro and the credits. */
const PREPARED_FOR_MS = 15 * 60_000

/**
 * Prepares the next episode/track while the current one is ending (`active`): its details, media segments and the
 * stream info (PlaybackInfo) the player will ask for, under exactly the cache key it will use. Opening it then skips
 * those round trips. For transcodes the playlist is requested too, which gets the server going.
 */
export function usePreloadNext(next: BaseItemDto | null | undefined, active: boolean) {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const { settings } = useLocalSettings()
  const prepared = useRef<string | undefined>(undefined)

  useEffect(() => {
    const id = next?.Id
    if (!active || !id || prepared.current === id) return
    prepared.current = id
    const isAudio = next.MediaType === 'Audio'

    void (async () => {
      await queryClient.prefetchQuery(itemOptions(api, session.userId, id))
      // The same start position the player will arrive at: the beginning, or right after the intro.
      let startTicks = 0
      if (!isAudio) {
        const segments = await queryClient.fetchQuery(segmentsOptions(api, id)).catch(() => [])
        if (settings.startAfterIntro) startTicks = secondsToTicks(startAfterIntro(0, segments))
      }
      const playback = await queryClient.fetchQuery({
        ...playbackOptions(api, session, id, isAudio, initialChoice(settings, startTicks)),
        gcTime: PREPARED_FOR_MS,
      })
      if (playback.hls) await fetch(playback.url).catch(() => undefined)
    })().catch(() => undefined)
  }, [active, next, api, session, queryClient, settings])
}
