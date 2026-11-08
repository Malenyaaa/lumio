import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconCheck } from '@tabler/icons-react'
import { useEffect } from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { externalOf } from '@/lib/external-items'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { downloadCollection, downloadId, downloadsAvailable, removeDownload, syncDownload, useDownloadState, useTrackDownload } from './player/downloads'

const messages = defineMessages({
  de: {
    download: 'Herunterladen',
    remove: 'Download entfernen',
    progress: (done: number, total: number) => `Wird heruntergeladen: ${done} von ${total}`,
    current: (name: string, percent: number) => `„${name}“: ${percent} %`,
    downloaded: 'Heruntergeladen',
    loading: (percent: number) => `Wird heruntergeladen: ${percent} %`,
    queued: 'Wartet auf den Download',
  },
  en: {
    download: 'Download',
    remove: 'Remove download',
    progress: (done: number, total: number) => `Downloading: ${done} of ${total}`,
    current: (name: string, percent: number) => `“${name}”: ${percent}%`,
    downloaded: 'Downloaded',
    loading: (percent: number) => `Downloading: ${percent}%`,
    queued: 'Waiting to download',
  },
})

/** The download ids of some items, and where those from outside the library (episodes) are fetched from. */
function entriesOf(items: BaseItemDto[]) {
  const urls: Record<string, string> = {}
  const ids = items
    .map((item) => {
      const external = externalOf(item)
      const id = downloadId(item, external?.guid)
      if (external && id) urls[id] = external.url
      return id
    })
    .filter(Boolean)
  return { ids, urls: Object.keys(urls).length ? urls : undefined }
}

/** Downloading (or removing) an album, playlist or episode; keeps a downloaded one in step with its songs. */
function useDownload(downloadKey: string, name: string, items: BaseItemDto[] | undefined, group?: string) {
  const state = useDownloadState(downloadKey)
  const ids = items ? entriesOf(items).ids.join(',') : null
  // A downloaded playlist follows its songs: added ones are fetched, removed ones dropped.
  useEffect(() => {
    if (state.saved && ids !== null) syncDownload(downloadKey, ids ? ids.split(',') : [])
  }, [downloadKey, ids, state.saved])
  const toggle = () => {
    if (state.saved) removeDownload(downloadKey)
    else if (items) {
      const { ids: list, urls } = entriesOf(items)
      downloadCollection(downloadKey, name, list, urls, group)
    }
  }
  return { state, toggle }
}

/**
 * The download button of an album, playlist or episode, as Spotify's: an arrow in a circle; while downloading a ring
 * fills up; once there, a filled green circle ("Remove download").
 */
export function DownloadButton({
  downloadKey,
  name,
  items,
  group,
  className,
}: {
  downloadKey: string
  name: string
  items: BaseItemDto[] | undefined
  /** What it belongs to in the library (an episode's podcast), for the "Downloaded" filter. */
  group?: string
  className?: string
}) {
  const t = useMessages(messages)
  const { state, toggle } = useDownload(downloadKey, name, items, group)
  if (!downloadsAvailable) return null
  const done = state.saved && state.done >= state.total
  // The song coming in now, by name, with how far it is.
  const now = state.saved && state.current ? items?.find((item) => downloadId(item, externalOf(item)?.guid) === state.current!.id) : undefined
  const label = state.saved
    ? done
      ? t.remove
      : [t.progress(state.done, state.total), now && state.current ? t.current(now.Name ?? '', Math.round(state.current.share * 100)) : ''].filter(Boolean).join(' · ')
    : t.download
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={state.saved}
      disabled={!items?.length && !state.saved}
      onClick={toggle}
      className={cn(
        'grid size-10 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        state.saved ? 'text-listen' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <DownloadGlyph
        state={!state.saved ? 'none' : done ? 'done' : 'loading'}
        share={state.saved && state.total ? (state.done + (state.current?.share ?? 0)) / state.total : 0}
        className="size-8"
      />
    </button>
  )
}

/**
 * The download symbol in its three looks, all on one circle (the size of Tabler's circle icons, so they line up with
 * the buttons beside them): an outlined arrow, a ring filling up while it downloads, a filled circle once done.
 */
function DownloadGlyph({ state, share = 0, className }: { state: 'none' | 'queued' | 'loading' | 'done'; share?: number; className?: string }) {
  const length = 2 * Math.PI * 9
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className={cn('shrink-0', className)} aria-hidden>
      {state === 'done' ? (
        <circle cx="12" cy="12" r="9.75" fill="currentColor" />
      ) : state === 'loading' ? (
        <>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
          {/* From the top, clockwise. */}
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray={length}
            strokeDashoffset={length * (1 - Math.max(0.02, share))}
            transform="rotate(-90 12 12)"
            className="transition-[stroke-dashoffset] duration-300"
          />
        </>
      ) : (
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} />
      )}
      <path d="M12 8v8M8 12l4 4l4 -4" stroke={state === 'done' ? 'black' : 'currentColor'} strokeWidth={2} />
    </svg>
  )
}

/** "Download" in a menu, with a check once downloaded (choosing it again removes the download). */
export function DownloadMenuItem({ downloadKey, name, items }: { downloadKey: string; name: string; items: BaseItemDto[] | undefined }) {
  const t = useMessages(messages)
  const { state, toggle } = useDownload(downloadKey, name, items)
  if (!downloadsAvailable) return null
  return (
    <DropdownMenuItem onClick={toggle} disabled={!items?.length && !state.saved}>
      {/* The menu colours everything in a hovered entry; the green mark keeps its own colours. */}
      <DownloadGlyph state={state.saved ? 'done' : 'none'} className={cn('size-4', state.saved && 'text-listen!')} />
      <span className="flex-1">{t.download}</span>
      {state.saved && <IconCheck className="ml-auto text-listen!" />}
    </DropdownMenuItem>
  )
}

/**
 * The small mark before a song's artists (everywhere songs are listed): green once downloaded, a filling ring while it
 * comes in, a grey arrow while it waits its turn.
 */
export function DownloadedMark({ item, className }: { item: BaseItemDto; className?: string }) {
  const t = useMessages(messages)
  const download = useTrackDownload(downloadId(item, externalOf(item)?.guid))
  if (!download) return null
  const label = download.state === 'loading' ? t.loading(Math.round(download.share * 100)) : download.state === 'queued' ? t.queued : t.downloaded
  return (
    <span role="img" aria-label={label} title={label} className={cn('mr-1.5 inline-grid align-[-3px]', download.state === 'queued' ? 'text-muted-foreground' : 'text-listen', className)}>
      <DownloadGlyph state={download.state} share={download.state === 'loading' ? download.share : 0} className="size-4" />
    </span>
  )
}
