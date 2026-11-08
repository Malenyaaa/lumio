import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useEffect, useMemo } from 'react'
import { useAuthedSession } from '@/features/auth/session'

/** One preview frame cut out of a trickplay sprite sheet. */
export interface TrickplayFrame {
  url: string
  /** Position and size of the frame inside the sheet, in sheet pixels. */
  x: number
  y: number
  width: number
  height: number
  /** Size of the whole sheet, in pixels, needed to scale the background image. */
  sheetWidth: number
  sheetHeight: number
}

export type TrickplayLookup = ((seconds: number) => TrickplayFrame | null) & {
  /** Every sprite sheet of the item, in playback order. */
  sheetUrls: string[]
}

/** Frame width that looks sharp at the preview's display size without downloading the biggest sheets. */
const PREFERRED_WIDTH = 320

/**
 * Seek-preview thumbnails from Jellyfin's trickplay data: the server pre-renders sprite sheets (tiles of small frames at a
 * fixed interval); this maps a time to the right frame. Returns `null` when the item has no trickplay images.
 */
export function useTrickplay(item: BaseItemDto | undefined, mediaSourceId: string | undefined): TrickplayLookup | null {
  const { api, session } = useAuthedSession()

  return useMemo(() => {
    const widths = item?.Trickplay?.[mediaSourceId ?? item?.Id ?? '']
    if (!item?.Id || !widths) return null
    const available = Object.values(widths).filter((info) => info.Width && info.Height && info.TileWidth && info.TileHeight && info.Interval)
    if (available.length === 0) return null
    const info = available.reduce((best, candidate) =>
      Math.abs((candidate.Width ?? 0) - PREFERRED_WIDTH) < Math.abs((best.Width ?? 0) - PREFERRED_WIDTH) ? candidate : best,
    )

    const { Width: width, Height: height, TileWidth: tileWidth, TileHeight: tileHeight, Interval: interval, ThumbnailCount: reported } = info as Required<typeof info>
    const perSheet = tileWidth * tileHeight
    // How many frames there are. Jellyfin 10.11 reports the number of sheets here (3 for a 39-minute episode), older
    // versions the number of frames: the runtime tells which, capped by what the reported sheets could hold.
    const byRuntime = item.RunTimeTicks ? Math.ceil(item.RunTimeTicks / 10_000 / interval) : 0
    const count = Math.max(reported, Math.min(byRuntime, reported * perSheet))
    const itemId = item.Id
    const source = mediaSourceId ?? itemId
    const base = api.basePath
    const token = encodeURIComponent(session.accessToken)

    const sheetUrl = (sheet: number) => `${base}/Videos/${itemId}/Trickplay/${width}/${sheet}.jpg?MediaSourceId=${source}&ApiKey=${token}`
    const lookup = (seconds: number): TrickplayFrame => {
      const index = Math.min(Math.max(Math.floor((seconds * 1000) / interval), 0), Math.max(count - 1, 0))
      const sheet = Math.floor(index / perSheet)
      const inSheet = index % perSheet
      return {
        url: sheetUrl(sheet),
        x: (inSheet % tileWidth) * width,
        y: Math.floor(inSheet / tileWidth) * height,
        width,
        height,
        sheetWidth: tileWidth * width,
        sheetHeight: tileHeight * height,
      }
    }
    const sheetUrls = Array.from({ length: Math.ceil(count / perSheet) }, (_, sheet) => sheetUrl(sheet))
    return Object.assign(lookup, { sheetUrls })
  }, [item, mediaSourceId, api, session.accessToken])
}

/** Sheets loaded at the same time; the rest queue, so preloading never competes much with the video itself. */
const PRELOAD_CONCURRENCY = 2

/**
 * Loads every sprite sheet in the background once `enabled` (the video is playing), so scrubbing shows frames
 * immediately instead of waiting for each sheet. The images are kept referenced so the browser keeps them in memory.
 */
export function usePreloadTrickplay(lookup: TrickplayLookup | null, enabled: boolean) {
  useEffect(() => {
    if (!lookup || !enabled) return
    const queue = [...lookup.sheetUrls]
    const images: HTMLImageElement[] = []
    let cancelled = false
    const next = () => {
      const url = queue.shift()
      if (!url || cancelled) return
      const image = new Image()
      image.decoding = 'async'
      image.onload = image.onerror = next
      image.src = url
      images.push(image)
    }
    for (let i = 0; i < PRELOAD_CONCURRENCY; i++) next()
    return () => {
      cancelled = true
      // Stop downloads still in flight; finished sheets stay in the browser cache.
      for (const image of images) if (!image.complete) image.src = ''
    }
  }, [lookup, enabled])
}
