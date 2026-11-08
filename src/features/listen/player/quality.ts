import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useItem } from '@/features/items/queries'
import { useLocalSettings } from '@/features/settings/local-settings'
import { externalOf } from '@/lib/external-items'

/**
 * What quality a track plays in. The music player asks Jellyfin's universal endpoint for whatever the browser can
 * decode as it is (`DIRECT_FORMATS`); anything else, or anything above the quality limit set in the settings, the
 * server converts to MP3 on the fly. Lossless formats (FLAC, ALAC, WAV) played as they are count as "Lossless".
 */
export const DIRECT_FORMATS = 'opus,webm|opus,mp3,aac,m4a|aac,m4b|aac,flac,webma,webm|webma,wav,ogg'

/** Conversions go to MP3, at most at this bitrate (what MP3 offers at best). */
const MP3_MAX = 320_000
const LOSSLESS = new Set(['flac', 'alac', 'wav', 'pcm', 'ape', 'wavpack', 'wv', 'dsd', 'aiff'])

export interface TrackQuality {
  /** Short label for the player bar: "Lossless", "MP3 · 320 kbps". */
  label: string
  lossless: boolean
  /** Converted by the server on the way. */
  converted: boolean
  /** Why it is converted. */
  reason?: 'format' | 'limit'
  /** What arrives in the browser. */
  playing: { codec: string; bitrate?: number; bitDepth?: number; sampleRate?: number }
  /** The file in the library (the best this track can sound). */
  source: { codec: string; container?: string; bitrate?: number; bitDepth?: number; sampleRate?: number; channels?: number }
  sourceLossless: boolean
}

const isLossless = (codec: string) => LOSSLESS.has(codec) || codec.startsWith('pcm')

/** Whether the browser gets this container and codec as they are (an entry is `container` or `container|codec`). */
function playsDirectly(container: string, codec: string) {
  return DIRECT_FORMATS.split(',').some((entry) => {
    const [formats, codecs] = entry.split('|')
    return formats!.split(',').includes(container) && (!codecs || codecs.split(',').includes(codec))
  })
}

export function describeQuality(item: BaseItemDto | undefined, limitKbps: number | null): TrackQuality | undefined {
  const source = item?.MediaSources?.[0]
  const stream = source?.MediaStreams?.find((entry) => entry.Type === 'Audio')
  if (!source || !stream) return undefined
  const codec = (stream.Codec ?? source.Container ?? '').toLowerCase()
  const container = (source.Container ?? '').toLowerCase().split(',')[0] ?? ''
  const bitrate = stream.BitRate ?? source.Bitrate ?? undefined
  const sourceInfo = { codec, container, bitrate, bitDepth: stream.BitDepth ?? undefined, sampleRate: stream.SampleRate ?? undefined, channels: stream.Channels ?? undefined }
  const sourceLossless = isLossless(codec)
  const limit = limitKbps ? limitKbps * 1000 : null
  const overLimit = !!limit && !!bitrate && bitrate > limit
  const direct = playsDirectly(container, codec) && !overLimit
  if (direct) {
    return {
      label: sourceLossless ? 'Lossless' : `${codec.toUpperCase()} · ${Math.round((bitrate ?? 0) / 1000)} kbps`,
      lossless: sourceLossless,
      converted: false,
      playing: { codec, bitrate, bitDepth: sourceInfo.bitDepth, sampleRate: sourceInfo.sampleRate },
      source: sourceInfo,
      sourceLossless,
    }
  }
  const target = Math.min(bitrate ?? MP3_MAX, limit ?? MP3_MAX, MP3_MAX)
  return {
    label: `MP3 · ${Math.round(target / 1000)} kbps`,
    lossless: false,
    converted: true,
    reason: overLimit ? 'limit' : 'format',
    playing: { codec: 'mp3', bitrate: target, sampleRate: sourceInfo.sampleRate },
    source: sourceInfo,
    sourceLossless,
  }
}

/** The quality of a library track as it plays on this device (nothing for podcast episodes). */
export function useTrackQuality(track: BaseItemDto | undefined) {
  const { settings } = useLocalSettings()
  const external = !!externalOf(track)
  // The single-item request carries the media sources (codec, bit depth, sample rate).
  const item = useItem(track?.Id ?? '', !!track?.Id && !external)
  return external ? undefined : describeQuality(item.data, settings.musicQuality)
}
