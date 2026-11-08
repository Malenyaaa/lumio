import type { Api } from '@jellyfin/sdk'
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import type { QueryClient } from '@tanstack/react-query'
import { landscapeImageUrl } from '@/lib/images'
import { albumTracksOptions, itemOptions, seriesPlayTargetOptions } from './queries'

/** Resolves when the browser has fetched (or failed to fetch) the image, so a failure never blocks the caller. */
function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

/**
 * Everything the hover preview shows, fetched ahead of time: the full item (genres, overview, rating), what "play" would
 * start, and the preview image. It fills the same caches the preview reads, so the card appears already complete.
 */
export function preloadPreview(queryClient: QueryClient, api: Api, userId: string, item: BaseItemDto): Promise<unknown> {
  const jobs: Array<Promise<unknown>> = [queryClient.prefetchQuery(itemOptions(api, userId, item.Id!))]
  if (item.Type === 'Series') jobs.push(queryClient.prefetchQuery(seriesPlayTargetOptions(api, userId, item.Id!)))
  if (item.Type === 'MusicAlbum') jobs.push(queryClient.prefetchQuery(albumTracksOptions(api, userId, item.Id!)))
  const image = landscapeImageUrl(api, item, { fillWidth: 640 })
  if (image) jobs.push(preloadImage(image))
  return Promise.allSettled(jobs)
}
