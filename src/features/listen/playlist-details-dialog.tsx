import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconDots, IconLock, IconPencil, IconPhoto, IconTrash, IconWorld } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useIsAdmin } from '@/features/admin/use-admin-config'
import { defineMessages, useMessages } from '@/lib/i18n'
import { MosaicCover, PlaylistCover } from './playlist-cards'
import { hasCustomCover, usePlaylistActions } from './playlists'

const messages = defineMessages({
  de: {
    title: 'Details bearbeiten',
    name: 'Name',
    namePlaceholder: 'Name hinzufügen',
    description: 'Beschreibung',
    descriptionPlaceholder: 'Optionale Beschreibung hinzufügen',
    choosePhoto: 'Foto auswählen',
    removePhoto: 'Foto entfernen',
    photoOptions: 'Foto-Optionen',
    publish: 'Veröffentlichen',
    makePrivate: 'Privat machen',
    save: 'Speichern',
    saved: 'Gespeichert',
    failed: 'Speichern fehlgeschlagen',
    notAnImage: 'Das ist kein Bild.',
    adminOnly: 'Cover und Beschreibung kann in Jellyfin nur ein Admin ändern.',
  },
  en: {
    title: 'Edit details',
    name: 'Name',
    namePlaceholder: 'Add a name',
    description: 'Description',
    descriptionPlaceholder: 'Add an optional description',
    choosePhoto: 'Choose photo',
    removePhoto: 'Remove photo',
    photoOptions: 'Photo options',
    publish: 'Make public',
    makePrivate: 'Make private',
    save: 'Save',
    saved: 'Saved',
    failed: "Couldn't save",
    notAnImage: "That's not an image.",
    adminOnly: 'In Jellyfin, only an admin can change the cover and description.',
  },
})

/**
 * Spotify's "Edit details" for a playlist: the cover (pick a photo, or remove it to go back to the mosaic), name and
 * description side by side, publishing at the bottom left and saving at the bottom right. Jellyfin only lets admins
 * set images and descriptions; for others those stay read-only, with a note why.
 */
export function PlaylistDetailsDialog({
  playlist,
  tracks,
  isPublic,
  open,
  onOpenChange,
  focus = 'name',
}: {
  playlist: BaseItemDto
  tracks: BaseItemDto[]
  isPublic: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which field gets the cursor (the cover opens it with nothing focused). */
  focus?: 'name' | 'none'
}) {
  const t = useMessages(messages)
  const isAdmin = useIsAdmin()
  const actions = usePlaylistActions()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [publicNow, setPublicNow] = useState(false)
  // undefined: unchanged; null: removed; otherwise the new photo with a URL to show it.
  const [image, setImageState] = useState<{ file: File; url: string } | null | undefined>(undefined)
  const setImage = (next: File | null | undefined) => setImageState(next ? { file: next, url: URL.createObjectURL(next) } : next)
  const preview = image?.url
  // A preview's URL is released once it is replaced or the dialog goes away.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  // Each opening starts from the playlist as it is.
  const [openedFor, setOpenedFor] = useState<boolean>(false)
  if (open !== openedFor) {
    setOpenedFor(open)
    if (open) {
      setName(playlist.Name ?? '')
      setDescription(playlist.Overview ?? '')
      setPublicNow(isPublic)
      setImage(undefined)
    }
  }

  const customCover = image === undefined ? hasCustomCover(playlist) : image !== null
  const pick = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error(t.notAnImage)
    setImage(file)
  }
  const save = () => {
    if (!name.trim()) return
    actions.editDetails.mutate(
      {
        playlistId: playlist.Id!,
        name: name.trim(),
        isPublic: publicNow,
        ...(isAdmin ? { description: description.trim(), image: image === undefined ? undefined : (image?.file ?? null) } : {}),
      },
      { onSuccess: () => onOpenChange(false), onError: () => toast.error(t.failed) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[32rem]">
        <DialogTitle className="text-2xl font-bold">{t.title}</DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-[11.25rem_minmax(0,1fr)]">
            {/* The cover: hovering shows the pencil to choose a photo (admins). */}
            <div className="group relative mx-auto aspect-square w-45 overflow-hidden rounded-md bg-muted shadow-lg shadow-black/40 sm:w-full">
              {preview ? (
                <img src={preview} alt="" className="size-full object-cover" />
              ) : image === null ? (
                <MosaicCover tracks={tracks} />
              ) : (
                <PlaylistCover playlist={playlist} tracks={tracks} />
              )}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm font-semibold text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <IconPencil className="size-10" stroke={1.5} />
                    {t.choosePhoto}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={t.photoOptions}
                      className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white opacity-0 outline-none transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100"
                    >
                      <IconDots className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                        <IconPhoto /> {t.choosePhoto}
                      </DropdownMenuItem>
                      {customCover && (
                        <DropdownMenuItem onClick={() => setImage(null)}>
                          <IconTrash /> {t.removePhoto}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      pick(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Input
                aria-label={t.name}
                placeholder={t.namePlaceholder}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus={focus === 'name'}
                maxLength={100}
                className="h-10 bg-foreground/10"
              />
              <textarea
                aria-label={t.description}
                placeholder={t.descriptionPlaceholder}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!isAdmin}
                maxLength={300}
                className="min-h-28 flex-1 resize-none rounded-lg border border-input bg-foreground/10 px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
          {!isAdmin && <p className="text-xs text-muted-foreground">{t.adminOnly}</p>}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-pressed={publicNow}
              onClick={() => setPublicNow(!publicNow)}
              className="flex h-9 items-center gap-2 rounded-full border border-foreground/40 px-4 text-sm font-semibold transition-colors hover:border-foreground"
            >
              {publicNow ? <IconLock className="size-4" /> : <IconWorld className="size-4" />}
              {publicNow ? t.makePrivate : t.publish}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || actions.editDetails.isPending}
              className="h-12 rounded-full bg-foreground px-8 text-base font-bold text-background transition-transform hover:scale-[1.03] disabled:opacity-50 disabled:hover:scale-100"
            >
              {t.save}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
