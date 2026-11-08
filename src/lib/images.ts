import type { Api } from '@jellyfin/sdk'
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api'
import { externalOf } from './external-items'
import type { LocalImageKind, LocalizedItem } from './localized'

type Size = { fillWidth?: number; fillHeight?: number }

/** A Jellyfin image (by item, type and tag), or a ready address (a picture in the interface's language). */
type Candidate = [id: string | null | undefined, type: ImageType, tag: string | null | undefined] | string | undefined

/**
 * Builds image URLs only for images the server says exist (a tag is present).
 * The SDK's own helper returns tag-less URLs for missing images, which 404.
 */
function pick(api: Api, candidates: Candidate[], size: Size) {
  const images = getImageApi(api)
  for (const candidate of candidates) {
    if (typeof candidate === 'string') return candidate
    const [id, type, tag] = candidate ?? []
    if (id && type && tag) return images.getItemImageUrlById(id, type, { ...size, tag, quality: 90 })
  }
  return undefined
}

/** The item's (or its series') picture in the interface's language, when it has one (see lib/localized). */
const local = (item: LocalizedItem, whose: 'own' | 'series', kind: LocalImageKind) => item.LumioImages?.[whose][kind]

export function portraitImageUrl(api: Api, item: BaseItemDto, size: Size = { fillHeight: 360 }) {
  // Podcast episodes bring their own artwork.
  const external = externalOf(item)
  if (external) return external.image
  return pick(
    api,
    [
      local(item, 'own', 'Primary'),
      [item.Id, ImageType.Primary, item.ImageTags?.Primary],
      local(item, 'series', 'Primary'),
      [item.SeriesId, ImageType.Primary, item.SeriesPrimaryImageTag],
      [item.AlbumId, ImageType.Primary, item.AlbumPrimaryImageTag],
      [item.ParentPrimaryImageItemId, ImageType.Primary, item.ParentPrimaryImageTag],
    ],
    size,
  )
}

export function landscapeImageUrl(api: Api, item: BaseItemDto, size: Size = { fillWidth: 480 }) {
  // An episode's own still is the best 16:9 image; everything else prefers its Thumb.
  const stillTag = item.Type === 'Episode' ? item.ImageTags?.Primary : undefined
  return pick(
    api,
    [
      [item.Id, ImageType.Primary, stillTag],
      local(item, 'own', 'Thumb'),
      [item.Id, ImageType.Thumb, item.ImageTags?.Thumb],
      local(item, 'series', 'Thumb'),
      [item.ParentThumbItemId, ImageType.Thumb, item.ParentThumbImageTag],
      [item.Id, ImageType.Backdrop, item.BackdropImageTags?.[0]],
      [item.ParentBackdropItemId, ImageType.Backdrop, item.ParentBackdropImageTags?.[0]],
      local(item, 'own', 'Primary'),
      [item.Id, ImageType.Primary, item.ImageTags?.Primary],
    ],
    size,
  )
}

export function backdropImageUrl(api: Api, item: BaseItemDto, size: Size = { fillWidth: 1600 }) {
  return pick(
    api,
    [
      [item.Id, ImageType.Backdrop, item.BackdropImageTags?.[0]],
      [item.ParentBackdropItemId, ImageType.Backdrop, item.ParentBackdropImageTags?.[0]],
      [item.Id, ImageType.Thumb, item.ImageTags?.Thumb],
    ],
    size,
  )
}

/** Title logo (transparent artwork); episodes fall back to their series' logo. */
export function logoImageUrl(api: Api, item: BaseItemDto, size: Size = { fillWidth: 640 }) {
  return pick(
    api,
    [
      local(item, 'own', 'Logo'),
      [item.Id, ImageType.Logo, item.ImageTags?.Logo],
      local(item, 'series', 'Logo'),
      [item.ParentLogoItemId, ImageType.Logo, item.ParentLogoImageTag],
    ],
    size,
  )
}
