import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthedSession } from '@/features/auth/session'
import { DownloadGlyph } from '@/features/listen/download-ui'
import { useLocalSettings } from '@/features/settings/local-settings'
import { defineMessages, useMessages } from '@/lib/i18n'
import { useOffline } from '@/lib/network'
import { cn } from '@/lib/utils'
import { useVideoStored, videoCacheAvailable } from './video-cache'
import {
  downloadVideos,
  removeEpisodeDownload,
  removeVideoDownload,
  setVideoDownloadSource,
  syncSeasonDownload,
  useSeasonDownload,
  useVideoDownload,
  type VideoDownloadState,
} from './video-downloads'

const MBIT = 1_000_000

const messages = defineMessages({
  de: {
    download: 'Herunterladen',
    downloaded: 'Heruntergeladen',
    remove: 'Download entfernen',
    loading: (percent: number) => `Wird heruntergeladen: ${percent} %`,
    queued: 'Wartet auf den Download',
    failed: (reason: string) => `Fehlgeschlagen: ${reason}. Wird gleich erneut versucht.`,
    failure_network: 'Verbindung unterbrochen',
    failure_storage: 'Speicher voll',
    failure_server: 'Fehler des Servers',
    failure_other: 'Unbekannter Fehler',
    downloadSeason: 'Staffel herunterladen',
    seasonDownloaded: 'Staffel heruntergeladen',
    seasonProgress: (done: number, total: number) => `${done} von ${total} heruntergeladen`,
    downloadEpisode: (name: string) => `„${name}“ herunterladen`,
    removeEpisode: (name: string) => `Download von „${name}“ entfernen`,
    unavailable: 'Offline nicht verfügbar',
  },
  en: {
    download: 'Download',
    downloaded: 'Downloaded',
    remove: 'Remove download',
    loading: (percent: number) => `Downloading: ${percent}%`,
    queued: 'Waiting to download',
    failed: (reason: string) => `Failed: ${reason}. Trying again shortly.`,
    failure_network: 'connection lost',
    failure_storage: 'storage full',
    failure_server: 'server error',
    failure_other: 'unknown error',
    downloadSeason: 'Download season',
    seasonDownloaded: 'Season downloaded',
    seasonProgress: (done: number, total: number) => `${done} of ${total} downloaded`,
    downloadEpisode: (name: string) => `Download “${name}”`,
    removeEpisode: (name: string) => `Remove the download of “${name}”`,
    unavailable: 'Not available offline',
  },
})

/** Hands the video downloads where to fetch from (and in which quality) while someone is signed in. */
export function VideoDownloadsHost() {
  const { api, session } = useAuthedSession()
  const { settings } = useLocalSettings()
  const bitrate = settings.videoDownloadMbit * MBIT
  useEffect(() => {
    setVideoDownloadSource({ api, session, bitrate })
    return () => setVideoDownloadSource(null)
  }, [api, session, bitrate])
  return null
}

/** Offline, a film or episode without a stored copy can't be played: shown greyed out (as songs are in Listen). */
export function useVideoUnavailable(itemId: string | null | undefined) {
  const offline = useOffline()
  const stored = useVideoStored(itemId)
  return !!itemId && offline && !stored
}

const glyphState = (download: VideoDownloadState) => (download ? download.state : 'none')
const shareOf = (download: VideoDownloadState) => (download?.state === 'loading' ? download.share : 0)

function labelOf(t: (typeof messages)['de'], download: VideoDownloadState) {
  if (!download) return t.download
  if (download.state === 'loading') return t.loading(Math.round(download.share * 100))
  if (download.state === 'queued') return download.error ? t.failed(t[`failure_${download.error.kind}`]) : t.queued
  return t.downloaded
}

/** The film's download, beside its play button. */
export function MovieDownloadButton({ movie }: { movie: BaseItemDto }) {
  const t = useMessages(messages)
  const download = useVideoDownload(movie.Id)
  if (!videoCacheAvailable || !movie.Id) return null
  const key = `movie:${movie.Id}`
  return (
    <Button
      size="lg"
      variant="outline"
      aria-pressed={!!download}
      title={download ? t.remove : t.download}
      onClick={() => (download ? removeVideoDownload(key) : downloadVideos(key, 'movie', movie.Name ?? '', [movie]))}
      className={cn(download && 'text-listen hover:text-listen')}
    >
      <DownloadGlyph state={glyphState(download)} share={shareOf(download)} className="size-5" /> {labelOf(t, download)}
    </Button>
  )
}

/** A season's download, beside the season picker. Brings a downloaded season up to date with its episodes. */
export function SeasonDownloadButton({ series, seasons, season, episodes }: { series?: BaseItemDto; seasons: BaseItemDto[]; season?: BaseItemDto; episodes: BaseItemDto[] | undefined }) {
  const t = useMessages(messages)
  const download = useSeasonDownload(season?.Id)
  const seasonId = season?.Id
  useEffect(() => {
    if (seasonId && episodes?.length) syncSeasonDownload(seasonId, episodes)
  }, [seasonId, episodes])
  if (!videoCacheAvailable || !season?.Id) return null
  const key = `season:${season.Id}`
  const done = !!download && download.done >= download.total
  const label = !download ? t.downloadSeason : done ? t.seasonDownloaded : t.seasonProgress(download.done, download.total)
  return (
    <Button
      size="sm"
      variant="outline"
      aria-pressed={!!download}
      title={download ? t.remove : t.downloadSeason}
      disabled={!download && !episodes?.length}
      onClick={() =>
        download
          ? removeVideoDownload(key)
          : downloadVideos(key, 'season', `${series?.Name ?? ''} · ${season.Name ?? ''}`, episodes ?? [], [...(series ? [series] : []), ...seasons])
      }
      className={cn(download && 'text-listen hover:text-listen')}
    >
      <DownloadGlyph state={!download ? 'none' : done ? 'done' : 'loading'} share={download?.share ?? 0} className="size-4" /> {label}
    </Button>
  )
}

/**
 * An episode's download, in its row (series page). `context`: the series, its seasons and the season's episodes, kept
 * for offline use with it.
 */
export function EpisodeDownloadButton({ episode, context, className }: { episode: BaseItemDto; context: BaseItemDto[]; className?: string }) {
  const t = useMessages(messages)
  const download = useVideoDownload(episode.Id)
  if (!videoCacheAvailable || !episode.Id) return null
  const label = download ? `${labelOf(t, download)} · ${t.removeEpisode(episode.Name ?? '')}` : t.downloadEpisode(episode.Name ?? '')
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={!!download}
      onClick={(event) => {
        // The row is a link to the player.
        event.preventDefault()
        event.stopPropagation()
        if (download) removeEpisodeDownload(episode.Id!)
        else downloadVideos(`episode:${episode.Id}`, 'episode', episode.Name ?? '', [episode], context)
      }}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring',
        !download
          ? 'text-muted-foreground hover:text-foreground'
          : download.state === 'queued'
            ? download.error
              ? 'text-amber-500'
              : 'text-muted-foreground'
            : 'text-listen',
        className,
      )}
    >
      <DownloadGlyph state={glyphState(download)} share={shareOf(download)} className="size-7" />
    </button>
  )
}

/** The small mark of a downloaded (or downloading) episode, e.g. in the player's episode list. */
export function VideoDownloadMark({ itemId, className }: { itemId: string | null | undefined; className?: string }) {
  const t = useMessages(messages)
  const download = useVideoDownload(itemId)
  if (!download) return null
  return (
    <span role="img" aria-label={labelOf(t, download)} title={labelOf(t, download)} className={cn('inline-grid', download.state === 'queued' ? 'text-white/60' : 'text-listen', className)}>
      <DownloadGlyph state={download.state} share={shareOf(download)} className="size-4" />
    </span>
  )
}

export function useVideoDownloadMessages() {
  return useMessages(messages)
}
