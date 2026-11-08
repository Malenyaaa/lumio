import type { BaseItemDto, ImageInfo, ImageType, RemoteImageInfo, RemoteSearchResult } from '@jellyfin/sdk/lib/generated-client/models'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api'
import { getItemLookupApi } from '@jellyfin/sdk/lib/utils/api/item-lookup-api'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { getRemoteImageApi } from '@jellyfin/sdk/lib/utils/api/remote-image-api'
import { IconExternalLink, IconPhoto, IconRefresh, IconSearch, IconSettings, IconTrash, IconUpload, IconWand } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuthedSession } from '@/features/auth/session'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useIsAdmin } from './use-admin-config'

const messages = defineMessages({
  de: {
    manage: 'Verwalten',
    images: 'Bilder bearbeiten',
    identify: 'Identifizieren',
    refresh: 'Metadaten aktualisieren',
    editMetadata: 'Metadaten bearbeiten (Jellyfin)',
    imagesTitle: 'Bilder',
    imagesHint: 'Die Bilder dieses Titels: bei den Anbietern suchen, eigene hochladen oder entfernen.',
    search: 'Suchen',
    upload: 'Hochladen',
    remove: 'Entfernen',
    noImage: 'Kein Bild',
    searching: 'Suche …',
    noResults: 'Keine Treffer.',
    allLanguages: 'Alle Sprachen',
    use: 'Übernehmen',
    saved: 'Gespeichert',
    failed: 'Das hat nicht geklappt.',
    identifyTitle: 'Identifizieren',
    identifyHint: 'Sucht den Titel bei den Metadaten-Anbietern. Der gewählte Treffer ersetzt Metadaten und Kennungen.',
    name: 'Name',
    year: 'Jahr',
    providerIds: 'Kennungen (optional)',
    replaceImages: 'Auch alle Bilder ersetzen',
    identified: 'Identifiziert; die Metadaten werden neu geladen.',
    refreshTitle: 'Metadaten aktualisieren',
    refreshHint: 'Lädt Metadaten und Bilder bei den Anbietern neu. Das läuft auf dem Server und kann einen Moment dauern.',
    modeDefault: 'Nach neuen und geänderten Dateien suchen',
    modeMissing: 'Fehlende Metadaten ergänzen',
    modeReplace: 'Alle Metadaten ersetzen',
    replaceAllImages: 'Alle Bilder ersetzen',
    regenerateTrickplay: 'Vorschaubilder (Trickplay) neu erzeugen',
    start: 'Aktualisieren',
    refreshing: 'Aktualisierung gestartet.',
    typePrimary: 'Cover / Poster',
    typeBackdrop: 'Hintergrund',
    typeLogo: 'Logo',
    typeThumb: 'Vorschaubild',
    typeBanner: 'Banner',
    typeArt: 'Clearart',
    typeDisc: 'Disc',
  },
  en: {
    manage: 'Manage',
    images: 'Edit images',
    identify: 'Identify',
    refresh: 'Refresh metadata',
    editMetadata: 'Edit metadata (Jellyfin)',
    imagesTitle: 'Images',
    imagesHint: "This title's images: search the providers, upload your own or remove them.",
    search: 'Search',
    upload: 'Upload',
    remove: 'Remove',
    noImage: 'No image',
    searching: 'Searching …',
    noResults: 'No results.',
    allLanguages: 'All languages',
    use: 'Use',
    saved: 'Saved',
    failed: "That didn't work.",
    identifyTitle: 'Identify',
    identifyHint: 'Searches the metadata providers for the title. The chosen result replaces its metadata and ids.',
    name: 'Name',
    year: 'Year',
    providerIds: 'Ids (optional)',
    replaceImages: 'Replace all images too',
    identified: 'Identified; the metadata is being reloaded.',
    refreshTitle: 'Refresh metadata',
    refreshHint: 'Reloads metadata and images from the providers. It runs on the server and can take a moment.',
    modeDefault: 'Scan for new and updated files',
    modeMissing: 'Search for missing metadata',
    modeReplace: 'Replace all metadata',
    replaceAllImages: 'Replace all images',
    regenerateTrickplay: 'Regenerate seek previews (trickplay)',
    start: 'Refresh',
    refreshing: 'Refresh started.',
    typePrimary: 'Cover / poster',
    typeBackdrop: 'Backdrop',
    typeLogo: 'Logo',
    typeThumb: 'Thumb',
    typeBanner: 'Banner',
    typeArt: 'Clear art',
    typeDisc: 'Disc',
  },
})

type EditableImage = 'Primary' | 'Backdrop' | 'Logo' | 'Thumb' | 'Banner' | 'Art' | 'Disc'

/** Which image kinds a title has, by its type (as jellyfin-web offers them). */
function imageTypesFor(item: BaseItemDto): EditableImage[] {
  switch (item.Type) {
    case 'Movie':
    case 'Series':
    case 'BoxSet':
      return ['Primary', 'Backdrop', 'Logo', 'Thumb', 'Banner', 'Art', 'Disc']
    case 'Season':
    case 'Episode':
      return ['Primary', 'Backdrop', 'Thumb']
    case 'MusicAlbum':
      return ['Primary', 'Backdrop', 'Disc']
    case 'MusicArtist':
      return ['Primary', 'Backdrop', 'Logo', 'Thumb', 'Banner']
    default:
      return ['Primary', 'Backdrop', 'Thumb']
  }
}

/** The kinds of titles the providers can identify. */
const IDENTIFIABLE = new Set(['Movie', 'Series', 'MusicAlbum', 'MusicArtist', 'BoxSet', 'Book', 'MusicVideo', 'Trailer', 'Person'])

/** The ids the identify form offers, by type. */
function providerKeysFor(item: BaseItemDto): string[] {
  if (item.Type === 'MusicAlbum') return ['MusicBrainzAlbum', 'MusicBrainzReleaseGroup']
  if (item.Type === 'MusicArtist') return ['MusicBrainzArtist']
  if (item.Type === 'Series') return ['Tmdb', 'Imdb', 'Tvdb']
  return ['Tmdb', 'Imdb']
}

/** Reloads everything that shows the title after a change. */
function useRefreshViews() {
  const client = useQueryClient()
  return () => void client.invalidateQueries()
}

/** A file as base64 (Jellyfin's image upload takes the image's bytes encoded so, with its type as the content type). */
function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** One image kind: what is there (several backdrops), and searching, uploading or removing. */
function ImageKind({ item, type, infos, onChanged }: { item: BaseItemDto; type: EditableImage; infos: ImageInfo[]; onChanged: () => void }) {
  const t = useMessages(messages)
  const { api } = useAuthedSession()
  const fileInput = useRef<HTMLInputElement>(null)
  const [searching, setSearching] = useState(false)
  const [allLanguages, setAllLanguages] = useState(false)
  const remote = useQuery({
    queryKey: ['remote-images', item.Id, type, allLanguages],
    enabled: searching,
    queryFn: async () => (await getRemoteImageApi(api).getRemoteImages({ itemId: item.Id!, type: type as ImageType, includeAllLanguages: allLanguages, limit: 60 })).data.Images ?? [],
  })
  const done = (message: string) => {
    toast.success(message)
    onChanged()
  }
  const download = useMutation({
    mutationFn: (image: RemoteImageInfo) => getRemoteImageApi(api).downloadRemoteImage({ itemId: item.Id!, type: type as ImageType, imageUrl: image.Url! }),
    onSuccess: () => {
      setSearching(false)
      done(t.saved)
    },
    onError: () => toast.error(t.failed),
  })
  const upload = useMutation({
    mutationFn: async (file: File) =>
      getImageApi(api).setItemImage({ itemId: item.Id!, imageType: type as ImageType, body: (await fileBase64(file)) as unknown as File }, { headers: { 'Content-Type': file.type || 'image/jpeg' } }),
    onSuccess: () => done(t.saved),
    onError: () => toast.error(t.failed),
  })
  const remove = useMutation({
    mutationFn: (index: number) => getImageApi(api).deleteItemImageByIndex({ itemId: item.Id!, imageType: type as ImageType, imageIndex: index }),
    onSuccess: () => done(t.saved),
    onError: () => toast.error(t.failed),
  })
  const wide = type !== 'Primary' && type !== 'Disc'
  const busy = download.isPending || upload.isPending || remove.isPending
  return (
    <section className="space-y-2 border-b pb-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">{t[`type${type}` as const]}</h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setSearching(!searching)}>
          <IconSearch /> {t.search}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          <IconUpload /> {t.upload}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) upload.mutate(file)
            event.target.value = ''
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {infos.length === 0 && <p className="text-xs text-muted-foreground">{t.noImage}</p>}
        {infos.map((info) => (
          <div key={`${info.ImageIndex ?? 0}-${info.ImageTag}`} className={cn('group relative overflow-hidden rounded-md bg-muted', wide ? 'h-24 w-40' : 'h-36 w-24')}>
            <img
              src={`${api.basePath}/Items/${item.Id}/Images/${type}/${info.ImageIndex ?? 0}?tag=${info.ImageTag}&fillHeight=200`}
              alt=""
              className="size-full object-cover"
            />
            {info.Width && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">{`${info.Width}×${info.Height}`}</span>}
            <button
              type="button"
              aria-label={t.remove}
              title={t.remove}
              disabled={busy}
              onClick={() => remove.mutate(info.ImageIndex ?? 0)}
              className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/70 text-white opacity-0 pointer-coarse:opacity-100 transition-opacity hover:bg-destructive group-hover:opacity-100 focus-visible:opacity-100"
            >
              <IconTrash className="size-4" />
            </button>
          </div>
        ))}
      </div>
      {searching && (
        <div className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={allLanguages} onChange={(event) => setAllLanguages(event.target.checked)} /> {t.allLanguages}
          </label>
          {remote.isLoading && <p className="text-sm text-muted-foreground">{t.searching}</p>}
          {remote.data && !remote.data.length && <p className="text-sm text-muted-foreground">{t.noResults}</p>}
          <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2 overflow-y-auto">
            {remote.data?.map((image) => (
              <button
                key={image.Url}
                type="button"
                disabled={busy}
                onClick={() => download.mutate(image)}
                title={[image.ProviderName, image.Width && `${image.Width}×${image.Height}`, image.Language].filter(Boolean).join(' · ')}
                className="group overflow-hidden rounded-md bg-muted text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img src={image.ThumbnailUrl ?? image.Url ?? ''} alt="" loading="lazy" className={cn('w-full object-cover transition-opacity group-hover:opacity-80', wide ? 'aspect-video' : 'aspect-[2/3]')} />
                <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                  {[image.ProviderName, image.Width && `${image.Width}×${image.Height}`, image.Language].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ImagesDialog({ item, open, onOpenChange }: { item: BaseItemDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useMessages(messages)
  const { api } = useAuthedSession()
  const refreshViews = useRefreshViews()
  const infos = useQuery({
    queryKey: ['image-infos', item.Id],
    enabled: open,
    queryFn: async () => (await getImageApi(api).getItemImageInfos({ itemId: item.Id! })).data,
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-3xl">
        <div className="space-y-1 pr-8">
          <DialogTitle className="text-xl font-bold">
            {t.imagesTitle}: {item.Name}
          </DialogTitle>
          <DialogDescription>{t.imagesHint}</DialogDescription>
        </div>
        <div className="-mx-6 -mb-6 min-h-0 space-y-4 overflow-y-auto px-6 pb-6">
          {imageTypesFor(item).map((type) => (
            <ImageKind
              key={type}
              item={item}
              type={type}
              infos={(infos.data ?? []).filter((info) => info.ImageType === type)}
              onChanged={() => {
                void infos.refetch()
                refreshViews()
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function IdentifyDialog({ item, open, onOpenChange }: { item: BaseItemDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useMessages(messages)
  const { api } = useAuthedSession()
  const refreshViews = useRefreshViews()
  const keys = providerKeysFor(item)
  const [name, setName] = useState(item.Name ?? '')
  const [year, setYear] = useState(item.ProductionYear ? String(item.ProductionYear) : '')
  const [ids, setIds] = useState<Record<string, string>>(() => Object.fromEntries(keys.map((key) => [key, item.ProviderIds?.[key] ?? ''])))
  const [replaceImages, setReplaceImages] = useState(false)
  const search = useMutation({
    mutationFn: async (): Promise<RemoteSearchResult[]> => {
      const query = {
        ItemId: item.Id,
        SearchInfo: { Name: name.trim(), Year: year ? Number(year) : undefined, ProviderIds: Object.fromEntries(Object.entries(ids).filter(([, value]) => value.trim())) },
      }
      const lookup = getItemLookupApi(api)
      switch (item.Type) {
        case 'Movie':
          return (await lookup.getMovieRemoteSearchResults({ movieInfoRemoteSearchQuery: query })).data
        case 'Series':
          return (await lookup.getSeriesRemoteSearchResults({ seriesInfoRemoteSearchQuery: query })).data
        case 'MusicAlbum':
          return (await lookup.getMusicAlbumRemoteSearchResults({ albumInfoRemoteSearchQuery: query })).data
        case 'MusicArtist':
          return (await lookup.getMusicArtistRemoteSearchResults({ artistInfoRemoteSearchQuery: query })).data
        case 'BoxSet':
          return (await lookup.getBoxSetRemoteSearchResults({ boxSetInfoRemoteSearchQuery: query })).data
        case 'Book':
          return (await lookup.getBookRemoteSearchResults({ bookInfoRemoteSearchQuery: query })).data
        case 'MusicVideo':
          return (await lookup.getMusicVideoRemoteSearchResults({ musicVideoInfoRemoteSearchQuery: query })).data
        case 'Trailer':
          return (await lookup.getTrailerRemoteSearchResults({ trailerInfoRemoteSearchQuery: query })).data
        case 'Person':
          return (await lookup.getPersonRemoteSearchResults({ personLookupInfoRemoteSearchQuery: query })).data
        default:
          return []
      }
    },
    onError: () => toast.error(t.failed),
  })
  const apply = useMutation({
    mutationFn: (result: RemoteSearchResult) => getItemLookupApi(api).applySearchCriteria({ itemId: item.Id!, remoteSearchResult: result, replaceAllImages: replaceImages }),
    onSuccess: () => {
      toast.success(t.identified)
      onOpenChange(false)
      // Jellyfin reloads the metadata in the background: shown once it is done.
      window.setTimeout(refreshViews, 4000)
    },
    onError: () => toast.error(t.failed),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    search.mutate()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl">
        <div className="space-y-1 pr-8">
          <DialogTitle className="text-xl font-bold">
            {t.identifyTitle}: {item.Name}
          </DialogTitle>
          <DialogDescription>{t.identifyHint}</DialogDescription>
        </div>
        <div className="-mx-6 -mb-6 min-h-0 space-y-4 overflow-y-auto px-6 pb-6">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t.name}</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t.year}</span>
              <Input value={year} inputMode="numeric" onChange={(event) => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))} />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t.providerIds}</p>
            {keys.map((key) => (
              <label key={key} className="grid gap-1 text-sm sm:col-span-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                <span className="text-muted-foreground">{key}</span>
                <Input value={ids[key] ?? ''} onChange={(event) => setIds({ ...ids, [key]: event.target.value })} />
              </label>
            ))}
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <label className="mr-auto flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replaceImages} onChange={(event) => setReplaceImages(event.target.checked)} /> {t.replaceImages}
              </label>
              <Button type="submit" disabled={search.isPending || !name.trim()}>
                <IconSearch /> {search.isPending ? t.searching : t.search}
              </Button>
            </div>
          </form>
          {search.data && !search.data.length && <p className="text-sm text-muted-foreground">{t.noResults}</p>}
          {!!search.data?.length && (
            <ul className="divide-y rounded-lg border">
              {search.data.map((result, index) => (
                <li key={`${result.SearchProviderName}-${index}`} className="flex items-center gap-3 p-2">
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">{result.ImageUrl && <img src={result.ImageUrl} alt="" loading="lazy" className="size-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {result.Name} {result.ProductionYear && <span className="text-muted-foreground">({result.ProductionYear})</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[result.SearchProviderName, ...Object.entries(result.ProviderIds ?? {}).map(([key, value]) => `${key}: ${value}`)].filter(Boolean).join(' · ')}
                    </p>
                    {result.Overview && <p className="line-clamp-2 text-xs text-muted-foreground">{result.Overview}</p>}
                  </div>
                  <Button size="sm" variant="outline" disabled={apply.isPending} onClick={() => apply.mutate(result)}>
                    {t.use}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type RefreshMode = 'default' | 'missing' | 'replace'

function RefreshDialog({ item, open, onOpenChange }: { item: BaseItemDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useMessages(messages)
  const { api } = useAuthedSession()
  const refreshViews = useRefreshViews()
  const [mode, setMode] = useState<RefreshMode>('missing')
  const [replaceImages, setReplaceImages] = useState(false)
  const [trickplay, setTrickplay] = useState(false)
  const video = item.Type === 'Movie' || item.Type === 'Episode' || item.Type === 'Series' || item.Type === 'Season'
  const refresh = useMutation({
    mutationFn: () =>
      getLibraryApi(api).refreshItem({
        itemId: item.Id!,
        metadataRefreshMode: mode === 'default' ? 'Default' : 'FullRefresh',
        imageRefreshMode: mode === 'default' ? 'Default' : 'FullRefresh',
        replaceAllMetadata: mode === 'replace',
        replaceAllImages: mode !== 'default' && replaceImages,
        regenerateTrickplay: video && trickplay,
      }),
    onSuccess: () => {
      toast.success(t.refreshing)
      onOpenChange(false)
      window.setTimeout(refreshViews, 5000)
    },
    onError: () => toast.error(t.failed),
  })
  const modes: Array<[RefreshMode, string]> = [
    ['default', t.modeDefault],
    ['missing', t.modeMissing],
    ['replace', t.modeReplace],
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-6 sm:max-w-md">
        <div className="space-y-1 pr-8">
          <DialogTitle className="text-xl font-bold">{t.refreshTitle}</DialogTitle>
          <DialogDescription>{t.refreshHint}</DialogDescription>
        </div>
        <div className="space-y-2">
          {modes.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="refresh-mode" checked={mode === value} onChange={() => setMode(value)} /> {label}
            </label>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <label className={cn('flex items-center gap-2 text-sm', mode === 'default' && 'opacity-50')}>
            <input type="checkbox" disabled={mode === 'default'} checked={replaceImages} onChange={(event) => setReplaceImages(event.target.checked)} /> {t.replaceAllImages}
          </label>
          {video && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={trickplay} onChange={(event) => setTrickplay(event.target.checked)} /> {t.regenerateTrickplay}
            </label>
          )}
        </div>
        <div className="flex justify-end">
          <Button disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            <IconRefresh /> {t.start}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Administrators' menu on a title's page: edit its images (search the providers, upload, remove), identify it, refresh
 * its metadata, and open Jellyfin's own metadata editor. Nothing for everyone else.
 */
export function MediaAdminMenu({ item, className }: { item: BaseItemDto | undefined; className?: string }) {
  const t = useMessages(messages)
  const isAdmin = useIsAdmin()
  const { session } = useAuthedSession()
  const [open, setOpen] = useState<'images' | 'identify' | 'refresh' | null>(null)
  if (!isAdmin || !item?.Id) return null
  const sameOrigin = session.serverUrl.replace(/\/+$/, '') === window.location.origin
  const editorUrl = `${sameOrigin ? '' : session.serverUrl}/web/#/metadata?id=${item.Id}`
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t.manage}
          title={t.manage}
          className={cn('grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', className)}
        >
          <IconSettings className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuItem onClick={() => setOpen('images')}>
            <IconPhoto /> {t.images}
          </DropdownMenuItem>
          {IDENTIFIABLE.has(item.Type ?? '') && (
            <DropdownMenuItem onClick={() => setOpen('identify')}>
              <IconWand /> {t.identify}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setOpen('refresh')}>
            <IconRefresh /> {t.refresh}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href={editorUrl} {...(sameOrigin ? {} : { target: '_blank', rel: 'noreferrer noopener' })} />}>
            <IconExternalLink /> {t.editMetadata}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open === 'images' && <ImagesDialog item={item} open onOpenChange={(next) => !next && setOpen(null)} />}
      {open === 'identify' && <IdentifyDialog item={item} open onOpenChange={(next) => !next && setOpen(null)} />}
      {open === 'refresh' && <RefreshDialog item={item} open onOpenChange={(next) => !next && setOpen(null)} />}
    </>
  )
}
