import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useMessages } from '@/lib/i18n'
import { playMessages } from './messages'
import { useAlbumTracks, useSeriesPlayTarget } from './queries'

/**
 * What "play" starts for an item and how the button should read: a movie plays itself, a series continues at the episode
 * in progress / next up, an album at the track in progress / first unheard one. Boxsets have nothing to play directly.
 */
export function usePlayTarget(item: BaseItemDto | undefined, enabled = true) {
  const t = useMessages(playMessages)
  const isSeries = item?.Type === 'Series'
  const isAlbum = item?.Type === 'MusicAlbum'
  const seriesTarget = useSeriesPlayTarget(enabled && isSeries ? item.Id : undefined)
  const tracks = useAlbumTracks(item?.Id, enabled && isAlbum)

  let target: BaseItemDto | null | undefined = item
  if (isSeries) target = seriesTarget.data
  if (isAlbum) {
    const list = tracks.data ?? []
    target = list.find((track) => track.UserData?.PlaybackPositionTicks) ?? list.find((track) => !track.UserData?.Played) ?? list[0]
  }
  // Collections and artists have nothing to play directly (an artist's page offers their tracks instead).
  if (!target?.Id || item?.Type === 'BoxSet' || item?.Type === 'MusicArtist') return { target: null, label: t.play, verb: t.play, detail: undefined }

  const verb = target.UserData?.PlaybackPositionTicks ? t.resume : t.play
  // What exactly plays, for series and albums: "S4 · E4", the track name. Kept apart so narrow places can shorten it.
  const detail = isSeries ? episodeCode(target, t.special) : isAlbum ? (target.Name ?? undefined) : undefined
  const label = detail ? `${verb} ${isAlbum ? '· ' : ''}${detail}` : verb
  return { target, label, verb, detail }
}

/** "S4 · E4"; just "E4" without a season number, "Special" for season 0, nothing when the numbers are unknown. */
export function episodeCode(episode: BaseItemDto, special: string) {
  const season = episode.ParentIndexNumber
  const number = episode.IndexNumber
  if (season === 0) return number != null ? `${special} ${number}` : special
  if (season != null && number != null) return `S${season} · E${number}`
  if (number != null) return `E${number}`
  return undefined
}
