import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconArrowDown, IconCheck, IconCircleArrowDown } from '@tabler/icons-react'
import { useEffect } from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { externalOf } from '@/lib/external-items'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { downloadCollection, downloadId, downloadsAvailable, removeDownload, syncDownload, useDownloadState, useIsDownloaded } from './player/downloads'

const messages = defineMessages({
  de: {
    download: 'Herunterladen',
    remove: 'Download entfernen',
    progress: (done: number, total: number) => `Wird heruntergeladen: ${done} von ${total}`,
    downloaded: 'Heruntergeladen',
  },
  en: {
    download: 'Download',
    remove: 'Remove download',
    progress: (done: number, total: number) => `Downloading: ${done} of ${total}`,
    downloaded: 'Downloaded',
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
function useDownload(downloadKey: string, name: string, items: BaseItemDto[] | undefined) {
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
      downloadCollection(downloadKey, name, list, urls)
    }
  }
  return { state, toggle }
}

/**
 * The download button of an album, playlist or episode, as Spotify's: an arrow in a circle; while downloading a ring
 * fills up; once there, a filled green circle ("Remove download").
 */
export function DownloadButton({ downloadKey, name, items, className }: { downloadKey: string; name: string; items: BaseItemDto[] | undefined; className?: string }) {
  const t = useMessages(messages)
  const { state, toggle } = useDownload(downloadKey, name, items)
  if (!downloadsAvailable) return null
  const done = state.saved && state.done >= state.total
  const label = state.saved ? (done ? t.remove : t.progress(state.done, state.total)) : t.download
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
      {!state.saved ? (
        <IconCircleArrowDown className="size-8" stroke={1.5} />
      ) : done ? (
        <span className="grid size-7 place-items-center rounded-full bg-listen text-black">
          <IconArrowDown className="size-4" stroke={2.5} />
        </span>
      ) : (
        <ProgressRing share={state.total ? state.done / state.total : 0} />
      )}
    </button>
  )
}

function ProgressRing({ share }: { share: number }) {
  const radius = 12
  const length = 2 * Math.PI * radius
  return (
    <span className="relative grid size-8 place-items-center">
      <svg viewBox="0 0 28 28" className="absolute inset-0 size-full -rotate-90">
        <circle cx="14" cy="14" r={radius} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
        <circle cx="14" cy="14" r={radius} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={length} strokeDashoffset={length * (1 - share)} strokeLinecap="round" />
      </svg>
      <IconArrowDown className="size-3.5" stroke={2.5} />
    </span>
  )
}

/** "Download" in a menu, with a check once downloaded (choosing it again removes the download). */
export function DownloadMenuItem({ downloadKey, name, items }: { downloadKey: string; name: string; items: BaseItemDto[] | undefined }) {
  const t = useMessages(messages)
  const { state, toggle } = useDownload(downloadKey, name, items)
  if (!downloadsAvailable) return null
  return (
    <DropdownMenuItem onClick={toggle} disabled={!items?.length && !state.saved}>
      {state.saved ? (
        <span className="grid size-4 place-items-center rounded-full bg-listen text-black">
          <IconArrowDown className="size-3" stroke={2.5} />
        </span>
      ) : (
        <IconCircleArrowDown />
      )}
      <span className="flex-1">{t.download}</span>
      {state.saved && <IconCheck className="ml-auto" />}
    </DropdownMenuItem>
  )
}

/** The small green mark of a downloaded song, before its artists (everywhere songs are listed). */
export function DownloadedMark({ item, className }: { item: BaseItemDto; className?: string }) {
  const t = useMessages(messages)
  const downloaded = useIsDownloaded(downloadId(item, externalOf(item)?.guid))
  if (!downloaded) return null
  return (
    <span role="img" aria-label={t.downloaded} title={t.downloaded} className={cn('mr-1.5 inline-grid size-3.5 shrink-0 place-items-center rounded-full bg-listen align-[-2px] text-black', className)}>
      <IconArrowDown className="size-2.5" stroke={3} />
    </span>
  )
}
