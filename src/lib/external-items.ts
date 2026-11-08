import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'

/**
 * Media from outside Jellyfin (podcast episodes) shaped as Jellyfin items, so the player, its queue and the cards
 * handle them like any track. What Jellyfin can't know (the audio file, the artwork, where its page is) rides along.
 */
export interface ExternalMedia {
  kind: 'podcast'
  /** The audio file, played straight from its host. */
  url: string
  image?: string
  /** Lumio's page for it. */
  href: string
  podcastId: string
  /** Stable id of the episode (its feed GUID), for progress. */
  guid: string
}

const EXTERNAL = '__lumioExternal'

export function externalOf(item: BaseItemDto | null | undefined): ExternalMedia | undefined {
  return item ? ((item as Record<string, unknown>)[EXTERNAL] as ExternalMedia | undefined) : undefined
}

export function externalItem(item: BaseItemDto, media: ExternalMedia): BaseItemDto {
  return { ...item, [EXTERNAL]: media } as BaseItemDto
}
