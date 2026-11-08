import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { useState, type DragEvent } from 'react'

/**
 * Dragging songs, as in Spotify: a song row can be dragged onto a playlist or Liked Songs in the library sidebar, or
 * onto the queue (the player bar's queue button or the open queue panel). The dragged tracks are kept here (the
 * browser's drag data only carries text); the target under the pointer is outlined.
 */
const TYPE = 'application/x-lumio-tracks'
/** Marks a drag that moves a song within the queue (it is no new song for the queue). */
export const QUEUE_MOVE_TYPE = 'application/x-lumio-queue'

let dragged: BaseItemDto[] | null = null

function setDragged(next: BaseItemDto[] | null) {
  dragged = next
}

/** Starts dragging tracks from a row; a small label with the title follows the pointer. */
export function startTrackDrag(event: DragEvent, tracks: BaseItemDto[]) {
  const playable = tracks.filter((track) => track.Id)
  if (!playable.length) return
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData(TYPE, playable.map((track) => track.Id).join(','))
  event.dataTransfer.setData('text/plain', playable.map((track) => track.Name).join('\n'))
  const label = document.createElement('div')
  label.textContent = playable.length === 1 ? (playable[0]!.Name ?? '') : `${playable[0]!.Name} +${playable.length - 1}`
  Object.assign(label.style, {
    position: 'fixed',
    top: '-1000px',
    padding: '6px 12px',
    borderRadius: '6px',
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    font: '600 14px/1.2 system-ui, sans-serif',
    maxWidth: '280px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.4)',
  })
  document.body.append(label)
  // Held at its left end, vertically centred, so the label sits right at the pointer instead of trailing below it.
  event.dataTransfer.setDragImage(label, 14, label.offsetHeight / 2)
  window.setTimeout(() => label.remove())
  // Set after the browser took its snapshot, so the row doesn't re-render mid-start.
  window.setTimeout(() => setDragged(playable))
}

export function endTrackDrag() {
  setDragged(null)
}

/**
 * Makes an element take dropped songs. `over` is true while songs hover it; spread `handlers` on the element.
 * `accept` can turn the target off (e.g. playlists the user may not change).
 */
export function useTrackDrop(onDrop: (tracks: BaseItemDto[]) => void, accept = true, { queueMoves = true }: { queueMoves?: boolean } = {}) {
  const [over, setOver] = useState(false)
  const takes = (event: DragEvent) => accept && event.dataTransfer.types.includes(TYPE) && (queueMoves || !event.dataTransfer.types.includes(QUEUE_MOVE_TYPE))
  return {
    over,
    handlers: {
      onDragEnter: (event: DragEvent) => {
        if (!takes(event)) return
        event.preventDefault()
        setOver(true)
      },
      onDragOver: (event: DragEvent) => {
        if (!takes(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      },
      onDragLeave: (event: DragEvent) => {
        // Moving onto a child also "leaves" the element itself.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setOver(false)
      },
      onDrop: (event: DragEvent) => {
        setOver(false)
        if (!takes(event) || !dragged) return
        event.preventDefault()
        const tracks = dragged
        setDragged(null)
        onDrop(tracks)
      },
    },
  }
}
