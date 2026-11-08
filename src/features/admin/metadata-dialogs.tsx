import { IconExternalLink, IconPencil, IconRefresh, IconSearch } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Link } from '@/components/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { lumioSend } from '@/features/social/social'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  de: {
    song: 'Song',
    artist: 'Künstler*in',
    error: 'Fehler',
    notFound: 'Auf MusicBrainz nicht gefunden.',
    notLookedUp: 'Noch nicht nachgeschlagen.',
    edited: 'Von Hand bearbeitet',
    picked: 'Von Hand zugeordnet',
    openAlbum: 'Zum Album',
    openArtist: 'Zur Künstlerseite',
    openRecording: 'Auf MusicBrainz ansehen',
    retry: 'Erneut nachschlagen',
    retried: 'Neu nachgeschlagen',
    retryFailed: 'MusicBrainz ist gerade nicht erreichbar.',
    search: 'Auf MusicBrainz suchen',
    searchTitle: 'Titel',
    searchArtist: 'Künstler*in',
    searching: 'Suche …',
    noResults: 'Keine Treffer.',
    assign: 'Zuordnen',
    assigned: 'Aufnahme zugeordnet',
    edit: 'Bearbeiten',
    save: 'Speichern',
    cancel: 'Abbrechen',
    saved: 'Gespeichert',
    editHint: 'Mehrere Namen durch Kommas trennen. Von Hand bearbeitete Angaben ersetzt kein automatisches Nachschlagen.',
    roleArtists: 'Künstler*innen',
    roleWriters: 'Songwriter*innen',
    roleComposers: 'Komponist*innen',
    roleLyricists: 'Texter*innen',
    roleProducers: 'Produktion',
    roleMixers: 'Mix',
    roleEngineers: 'Tontechnik',
    roleLabels: 'Label',
    rolePublishers: 'Verlag',
    isrc: 'ISRC',
    services: 'Was nicht geklappt hat',
    refetch: 'Erneut laden',
    refetched: 'Infos neu geladen',
    refetchPartly: (failed: string) => `Teilweise geladen: ${failed}`,
  },
  en: {
    song: 'Song',
    artist: 'Artist',
    error: 'Error',
    notFound: 'Not found on MusicBrainz.',
    notLookedUp: 'Not looked up yet.',
    edited: 'Edited by hand',
    picked: 'Matched by hand',
    openAlbum: 'Go to album',
    openArtist: 'Go to artist',
    openRecording: 'View on MusicBrainz',
    retry: 'Look up again',
    retried: 'Looked up again',
    retryFailed: "MusicBrainz can't be reached right now.",
    search: 'Search MusicBrainz',
    searchTitle: 'Title',
    searchArtist: 'Artist',
    searching: 'Searching …',
    noResults: 'No results.',
    assign: 'Use this',
    assigned: 'Recording matched',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Saved',
    editHint: 'Separate several names with commas. Credits edited by hand are never replaced by a lookup.',
    roleArtists: 'Artists',
    roleWriters: 'Songwriters',
    roleComposers: 'Composers',
    roleLyricists: 'Lyricists',
    roleProducers: 'Production',
    roleMixers: 'Mixing',
    roleEngineers: 'Engineering',
    roleLabels: 'Label',
    rolePublishers: 'Publisher',
    isrc: 'ISRC',
    services: "What didn't work",
    refetch: 'Fetch again',
    refetched: 'Information fetched again',
    refetchPartly: (failed: string) => `Partly fetched: ${failed}`,
  },
})

export interface TrackCredits {
  recording: string
  artists: string[]
  writers: string[]
  composers: string[]
  lyricists: string[]
  producers: string[]
  mixers: string[]
  engineers: string[]
  publishers: string[]
  labels: string[]
  isrc?: string
}

export interface TrackMetaInfo {
  title?: string
  artist?: string
  album?: string
  albumId?: string
  edited?: boolean
  picked?: boolean
}

type Role = 'artists' | 'writers' | 'composers' | 'lyricists' | 'producers' | 'mixers' | 'engineers' | 'labels' | 'publishers'
const ROLES: Role[] = ['artists', 'writers', 'composers', 'lyricists', 'producers', 'mixers', 'engineers', 'labels', 'publishers']
const roleKey = (role: Role) => `role${role[0]!.toUpperCase()}${role.slice(1)}` as `role${Capitalize<Role>}`

interface Candidate {
  id: string
  score: number
  title: string
  artist: string
  seconds?: number
  release?: string
  year?: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await lumioSend('POST', path, body)
  if (!response?.ok) throw new Error(`Lumio server ${response?.status ?? 'unreachable'}`)
  return (await response.json()) as T
}

const clock = (seconds?: number) => (seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '')

/**
 * A track's metadata for an admin: what is known (or why nothing is), looking it up again, picking the right recording
 * on MusicBrainz by hand, or writing the credits by hand.
 */
export function TrackMetadataDialog({ id, meta, error, onClose }: { id: string | null; meta: TrackMetaInfo; error?: string; onClose: () => void }) {
  const t = useMessages(messages)
  const client = useQueryClient()
  const credits = useQuery({
    queryKey: ['admin-track-credits', id],
    enabled: !!id,
    queryFn: async () => {
      const known = await post<Record<string, TrackCredits | null>>('/credits', { ids: [id] })
      return id! in known ? known[id!] : undefined
    },
  })
  const [query, setQuery] = useState({ title: meta.title ?? '', artist: meta.artist ?? '' })
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [editing, setEditing] = useState<Record<string, string> | null>(null)

  const done = (data: { credits: TrackCredits | null }, message: string) => {
    client.setQueryData(['admin-track-credits', id], data.credits)
    // Every list showing this track has the new credits at once.
    client.setQueryData(['track-credits', id], data.credits)
    void client.invalidateQueries({ queryKey: ['credits-missing'] })
    void client.invalidateQueries({ queryKey: ['admin-credits'] })
    void client.invalidateQueries({ queryKey: ['admin-job'] })
    toast.success(message)
  }
  const fix = useMutation({
    mutationFn: (recording?: string) => post<{ credits: TrackCredits | null }>('/admin/credits/fix', { id, recording, meta }),
    onSuccess: (data, recording) => done(data, recording ? t.assigned : t.retried),
    onError: () => toast.error(t.retryFailed),
  })
  const search = useMutation({
    mutationFn: () => post<Candidate[]>('/admin/credits/search', query),
    onSuccess: setCandidates,
    onError: () => toast.error(t.retryFailed),
  })
  const save = useMutation({
    mutationFn: (draft: Record<string, string>) => {
      const list = (value?: string) => (value ?? '').split(',').map((name) => name.trim()).filter(Boolean)
      return post<{ credits: TrackCredits | null }>('/admin/credits/edit', {
        id,
        meta,
        credits: { recording: credits.data?.recording ?? '', isrc: draft.isrc, ...Object.fromEntries(ROLES.map((role) => [role, list(draft[role])])) },
      })
    },
    onSuccess: (data) => {
      done(data, t.saved)
      setEditing(null)
    },
  })

  const current = credits.data
  const startEditing = () =>
    setEditing({ isrc: current?.isrc ?? '', ...Object.fromEntries(ROLES.map((role) => [role, (current?.[role] ?? (role === 'artists' && meta.artist ? [meta.artist] : [])).join(', ')])) })
  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    search.mutate()
  }

  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl">
        <div className="space-y-1 pr-8">
          <p className="text-xs font-medium text-muted-foreground">{t.song}</p>
          <DialogTitle className="truncate text-xl font-bold">{meta.title || '—'}</DialogTitle>
          <DialogDescription className="truncate">{[meta.artist, meta.album].filter(Boolean).join(' · ')}</DialogDescription>
        </div>
        <div className="-mx-6 -mb-6 min-h-0 space-y-5 overflow-y-auto px-6 pb-6">
          <div className="flex flex-wrap gap-2">
            {meta.albumId && (
              <Button variant="outline" size="sm" render={<Link to={`/listen/album/${meta.albumId}`} />}>
                {t.openAlbum}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={fix.isPending} onClick={() => fix.mutate(undefined)}>
              <IconRefresh /> {t.retry}
            </Button>
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <IconPencil /> {t.edit}
              </Button>
            )}
            {current?.recording && (
              <Button variant="ghost" size="sm" render={<a href={`https://musicbrainz.org/recording/${current.recording}`} target="_blank" rel="noreferrer noopener" />}>
                <IconExternalLink /> {t.openRecording}
              </Button>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <span className="font-medium">{t.error}:</span> {error}
            </p>
          )}

          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                save.mutate(editing)
              }}
            >
              <p className="text-xs text-muted-foreground">{t.editHint}</p>
              {[...ROLES, 'isrc' as const].map((key) => (
                <label key={key} className="grid gap-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <span className="text-muted-foreground">{key === 'isrc' ? t.isrc : t[roleKey(key)]}</span>
                  <Input value={editing[key] ?? ''} onChange={(event) => setEditing({ ...editing, [key]: event.target.value })} />
                </label>
              ))}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {t.save}
                </Button>
              </div>
            </form>
          ) : (
            <section className="space-y-2">
              {(meta.edited || meta.picked) && <p className="text-xs font-medium text-muted-foreground">{meta.edited ? t.edited : t.picked}</p>}
              {current === undefined ? (
                <p className="text-sm text-muted-foreground">{t.notLookedUp}</p>
              ) : current === null ? (
                <p className="text-sm text-muted-foreground">{t.notFound}</p>
              ) : (
                <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                  {ROLES.filter((role) => current[role]?.length).map((role) => (
                    <div key={role} className="contents">
                      <dt className="text-muted-foreground">{t[roleKey(role)]}</dt>
                      <dd>{current[role].join(', ')}</dd>
                    </div>
                  ))}
                  {current.isrc && (
                    <div className="contents">
                      <dt className="text-muted-foreground">{t.isrc}</dt>
                      <dd>{current.isrc}</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>
          )}

          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">{t.search}</h3>
            <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
              <Input aria-label={t.searchTitle} placeholder={t.searchTitle} value={query.title} onChange={(event) => setQuery({ ...query, title: event.target.value })} className="min-w-40 flex-1" />
              <Input aria-label={t.searchArtist} placeholder={t.searchArtist} value={query.artist} onChange={(event) => setQuery({ ...query, artist: event.target.value })} className="min-w-40 flex-1" />
              <Button type="submit" variant="outline" disabled={search.isPending}>
                <IconSearch /> {search.isPending ? t.searching : t.search}
              </Button>
            </form>
            {candidates && !candidates.length && <p className="text-sm text-muted-foreground">{t.noResults}</p>}
            {!!candidates?.length && (
              <ul className="divide-y rounded-lg border">
                {candidates.map((candidate) => (
                  <li key={candidate.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {candidate.title} <span className="font-normal text-muted-foreground">{clock(candidate.seconds)}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{[candidate.artist, candidate.release, candidate.year].filter(Boolean).join(' · ')}</p>
                    </div>
                    <a
                      href={`https://musicbrainz.org/recording/${candidate.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={t.openRecording}
                      title={t.openRecording}
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <IconExternalLink className="size-4" />
                    </a>
                    <Button size="sm" variant={current?.recording === candidate.id ? 'secondary' : 'outline'} disabled={fix.isPending} onClick={() => fix.mutate(candidate.id)}>
                      {t.assign}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** An artist whose information couldn't be fetched completely: what failed, and fetching it again. */
export function ArtistMetadataDialog({ id, name, error, onClose }: { id: string | null; name: string; error?: string; onClose: () => void }) {
  const t = useMessages(messages)
  const client = useQueryClient()
  const [failed, setFailed] = useState<string[] | null>(null)
  const refetch = useMutation({
    mutationFn: () =>
      post<{ found: boolean; failed: string[] }>('/admin/artists/fix', {
        id,
        name,
        lastfmKey: import.meta.env.VITE_LASTFM_API_KEY?.trim(),
      }),
    onSuccess: (result) => {
      setFailed(result.failed)
      void client.invalidateQueries({ queryKey: ['admin-job'] })
      // The app asks again for what it shows about the artist.
      void client.invalidateQueries({ queryKey: ['lastfm-artist'] })
      void client.invalidateQueries({ queryKey: ['epidemic-profile', name] })
      void client.invalidateQueries({ queryKey: ['artist-links'] })
      if (result.failed.length) toast.warning(t.refetchPartly(result.failed.join(' · ')))
      else toast.success(t.refetched)
    },
    onError: () => toast.error(t.retryFailed),
  })
  const problems = (failed ?? error?.split(' · ') ?? []).filter(Boolean)
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-lg">
        <div className="space-y-1 pr-8">
          <p className="text-xs font-medium text-muted-foreground">{t.artist}</p>
          <DialogTitle className="truncate text-xl font-bold">{name}</DialogTitle>
        </div>
        <div className="-mx-6 -mb-6 min-h-0 space-y-4 overflow-y-auto px-6 pb-6">
          {id && (
            <Button variant="outline" size="sm" render={<Link to={`/listen/artist/${id}`} />}>
              {t.openArtist}
            </Button>
          )}
          {problems.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t.services}</h3>
              <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </section>
          )}
          <Button disabled={refetch.isPending} onClick={() => refetch.mutate()}>
            <IconRefresh /> {t.refetch}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
