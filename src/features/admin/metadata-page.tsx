import { IconPlayerPlay, IconPlayerStop, IconSearch } from '@tabler/icons-react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserViews } from '@/features/home/queries'
import { useItem } from '@/features/items/queries'
import { Section, SettingsPage, SwitchField } from '@/features/settings/fields'
import { lumioGet, lumioSend } from '@/features/social/social'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { useLumioConfig } from './branding'
import { ArtistMetadataDialog, TrackMetadataDialog, type TrackCredits, type TrackMetaInfo } from './metadata-dialogs'
import { useIsAdmin, useSaveConfig } from './use-admin-config'

const messages = defineMessages({
  de: {
    title: 'Musik-Metadaten',
    description:
      'Lumio ergänzt die Bibliothek um Angaben von außen. Was gespielt oder geöffnet wird, schlägt Lumio von selbst nach; hier lässt sich alles auf einmal erledigen. Die Aufgaben laufen auf dem Lumio-Server weiter, auch wenn du die Seite verlässt.',
    adminOnly: 'Nur für Administrator*innen.',
    libraries: 'Bibliotheken',
    librariesHint: 'Welche Bibliotheken die Aufgaben durchgehen. Hörspiele oder Hörbücher etwa lassen sich ausschließen.',
    credits: 'Songinfos und Künstler*innen',
    creditsHint:
      'Schlägt jeden Song auf MusicBrainz nach, der noch nicht nachgeschlagen wurde: Gastkünstler*innen, die in den Datei-Tags fehlen, Songwriter*innen, Produktion, Label und Verlag. Etwa drei Sekunden pro Song (MusicBrainz erlaubt einen Abruf pro Sekunde).',
    creditsStart: 'Songs ergänzen',
    artists: 'Künstler*innen-Infos',
    artistsHint:
      'Lädt für alle Künstler*innen vorab, was Lumio zu ihnen zeigt: Beschreibung (Last.fm, Epidemic Sound), Fotos, beliebte Songs, ähnliche Künstler*innen und Links. Danach erscheinen Künstlerseiten sofort. Etwa fünf Sekunden pro Künstler*in.',
    artistsStart: 'Infos vorladen',
    stop: 'Anhalten',
    progress: (done: number, total: number) => `${done} von ${total}`,
    found: (found: number, failed: number) => `${found} mit Ergebnis${failed ? `, ${failed} fehlgeschlagen` : ''}`,
    finished: (when: string) => `Zuletzt beendet: ${when}`,
    nothing: 'Nichts mehr zu tun.',
    unavailable: 'Der Lumio-Server ist nicht erreichbar.',
    remaining: (minutes: number) => (minutes < 1 ? 'noch unter einer Minute' : `noch etwa ${minutes} Min.`),
    failedTitle: (n: number) => `Fehlgeschlagen (${n})`,
    failedHint: 'Hier hat ein Dienst nicht geantwortet. Diese Einträge werden beim nächsten Durchlauf erneut versucht; ein Klick zeigt Details.',
    missingTitle: (n: number) => `Songs nicht gefunden (${n})`,
    missingHint:
      'Für diese Songs gibt es auf MusicBrainz keine Aufnahme mit gleichem Titel, Künstler*in und ähnlicher Länge. Ein Klick öffnet die Suche, um die richtige Aufnahme von Hand zuzuordnen oder die Angaben selbst einzutragen.',
    lookedUp: (when: string) => `nachgeschlagen ${when}`,
    browse: 'Metadaten durchsuchen',
    browseHint: 'Alle nachgeschlagenen Songs. Ein Klick öffnet die Angaben zum Prüfen und Bearbeiten.',
    browseSearch: 'Titel, Künstler*in, Album oder Mitwirkende',
    browseCount: (n: number) => (n === 1 ? '1 Song' : `${n} Songs`),
    more: 'Mehr laden',
    noCredits: 'nicht gefunden',
    edited: 'von Hand',
  },
  en: {
    title: 'Music metadata',
    description:
      'Lumio adds information from outside to the library. What plays or is opened is looked up on its own; here everything can be done at once. The tasks keep running on the Lumio server when you leave this page.',
    adminOnly: 'Administrators only.',
    libraries: 'Libraries',
    librariesHint: 'Which libraries the tasks go through. Audio plays or audiobooks, say, can be left out.',
    credits: 'Song credits and artists',
    creditsHint:
      "Looks up every song on MusicBrainz that wasn't yet: featured artists missing from the file tags, songwriters, production, label and publisher. About three seconds a song (MusicBrainz allows one call a second).",
    creditsStart: 'Fill in songs',
    artists: 'Artist information',
    artistsHint:
      'Fetches ahead what Lumio shows about every artist: biography (Last.fm, Epidemic Sound), photos, popular songs, similar artists and links. Artist pages then open at once. About five seconds an artist.',
    artistsStart: 'Fetch information',
    stop: 'Stop',
    progress: (done: number, total: number) => `${done} of ${total}`,
    found: (found: number, failed: number) => `${found} with results${failed ? `, ${failed} failed` : ''}`,
    finished: (when: string) => `Last finished: ${when}`,
    nothing: 'Nothing left to do.',
    unavailable: "The Lumio server can't be reached.",
    remaining: (minutes: number) => (minutes < 1 ? 'under a minute left' : `about ${minutes} min left`),
    failedTitle: (n: number) => `Failed (${n})`,
    failedHint: "A service didn't answer for these. They are tried again on the next run; click one for details.",
    missingTitle: (n: number) => `Songs not found (${n})`,
    missingHint:
      'MusicBrainz has no recording with the same title, artist and a similar length for these songs. Click one to search for the right recording and match it by hand, or to enter the credits yourself.',
    lookedUp: (when: string) => `looked up ${when}`,
    browse: 'Browse metadata',
    browseHint: 'Every song looked up. Click one to check and edit what is known.',
    browseSearch: 'Title, artist, album or credits',
    browseCount: (n: number) => (n === 1 ? '1 song' : `${n} songs`),
    more: 'Load more',
    noCredits: 'not found',
    edited: 'by hand',
  },
})

interface Failure {
  id: string
  title: string
  artist?: string
  album?: string
  albumId?: string
  error: string
}

interface JobState {
  running: boolean
  total: number
  done: number
  found: number
  failed: number
  startedAt?: number
  finishedAt?: number
  error?: string
  failures: Failure[]
}

interface Stored {
  id: string
  at: number
  meta: TrackMetaInfo | null
  data?: TrackCredits | null
}

type JobName = 'credits' | 'artists'

/** What the popup shows: a song's metadata, or an artist whose information failed. */
type Opened = { kind: 'track'; id: string; meta: TrackMetaInfo; error?: string } | { kind: 'artist'; id: string; name: string; error?: string }

/** The music libraries the tasks can go through (not films or series). */
const MUSIC_TYPES = new Set(['music', 'audiobooks', 'books', 'musicvideos', 'mixed'])

/** An entry in the lists; opens its popup. */
function EntryRow({ title, line, onClick }: { title?: string; line?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
      <p className="truncate text-sm font-medium">{title || '—'}</p>
      {line && <p className="truncate text-xs text-muted-foreground">{line}</p>}
    </button>
  )
}

/** A stored song; names from Jellyfin for those looked up before Lumio kept them. */
function StoredRow({ song, note, onOpen }: { song: Stored; note: string; onOpen: (opened: Opened) => void }) {
  const item = useItem(song.id, !song.meta?.title).data
  const meta: TrackMetaInfo = song.meta?.title
    ? song.meta
    : { title: item?.Name ?? undefined, artist: item?.Artists?.[0], album: item?.Album ?? undefined, albumId: item?.AlbumId ?? undefined }
  return <EntryRow title={meta.title} line={[meta.artist, meta.album, note].filter(Boolean).join(' · ')} onClick={() => onOpen({ kind: 'track', id: song.id, meta })} />
}

function useJob(name: JobName, enabled: boolean) {
  return useQuery({
    queryKey: ['admin-job', name],
    enabled,
    // While it runs, the progress updates every few seconds.
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
    queryFn: async () => {
      const response = await lumioGet(`/admin/jobs/${name}`)
      if (!response?.ok) throw new Error('Unavailable')
      return (await response.json()) as JobState
    },
  })
}

/** One task: what it does, how far it is, start and stop, and what failed in its last run. */
function JobSection({
  name,
  title,
  hint,
  start,
  secondsEach,
  libraries,
  onOpen,
}: {
  name: JobName
  title: string
  hint: string
  start: string
  secondsEach: number
  libraries: string[]
  onOpen: (opened: Opened) => void
}) {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const client = useQueryClient()
  const state = useJob(name, true)
  const control = useMutation({
    mutationFn: async (method: 'POST' | 'DELETE') => {
      // The artist task asks Last.fm with the app's key, unless the server has its own.
      const body = method === 'POST' ? { libraries, ...(name === 'artists' ? { lastfmKey: import.meta.env.VITE_LASTFM_API_KEY?.trim() } : {}) } : undefined
      const response = await lumioSend(method, `/admin/jobs/${name}`, body)
      if (!response?.ok) throw new Error('Unavailable')
      return (await response.json()) as JobState
    },
    onSuccess: (data) => client.setQueryData(['admin-job', name], data),
  })
  const job = state.data
  const share = job?.total ? Math.round((job.done / job.total) * 100) : 0
  const remaining = job?.running && job.total ? Math.round(((job.total - job.done) * secondsEach) / 60) : undefined
  return (
    <>
      <Section title={title} description={hint}>
        <div className="space-y-4 p-4">
          {state.isError && <p className="text-sm text-destructive">{t.unavailable}</p>}
          {job && (job.running || job.finishedAt) && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${job.total ? share : 100}%` }} />
              </div>
              <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                {job.total ? <span className="text-foreground">{t.progress(job.done, job.total)}</span> : !job.running && <span>{t.nothing}</span>}
                {job.total > 0 && <span>{t.found(job.found, job.failed)}</span>}
                {remaining !== undefined && <span>{t.remaining(remaining)}</span>}
                {!job.running && job.finishedAt && <span>{t.finished(new Date(job.finishedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }))}</span>}
              </p>
              {job.error && <p className="text-sm text-destructive">{job.error}</p>}
            </div>
          )}
          {job?.running ? (
            <Button variant="outline" disabled={control.isPending} onClick={() => control.mutate('DELETE')}>
              <IconPlayerStop /> {t.stop}
            </Button>
          ) : (
            <Button disabled={control.isPending || !job || !libraries.length} onClick={() => control.mutate('POST')}>
              <IconPlayerPlay /> {start}
            </Button>
          )}
        </div>
      </Section>
      {!!job?.failures.length && (
        <Section title={`${title}: ${t.failedTitle(job.failures.length)}`} description={t.failedHint}>
          <div className="max-h-80 divide-y overflow-y-auto">
            {job.failures.map((entry) => (
              <EntryRow
                key={entry.id}
                title={entry.title}
                line={[entry.artist, entry.album, entry.error].filter(Boolean).join(' · ')}
                onClick={() =>
                  onOpen(
                    name === 'artists'
                      ? { kind: 'artist', id: entry.id, name: entry.title, error: entry.error }
                      : { kind: 'track', id: entry.id, meta: { title: entry.title, artist: entry.artist, album: entry.album, albumId: entry.albumId }, error: entry.error },
                  )
                }
              />
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

/** Every looked-up song, searchable; each opens its metadata. */
function BrowseSection({ onOpen }: { onOpen: (opened: Opened) => void }) {
  const t = useMessages(messages)
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  // Searches once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(term.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [term])
  const pages = useInfiniteQuery({
    queryKey: ['admin-credits', search],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await lumioGet(`/admin/credits?${new URLSearchParams({ search, offset: String(pageParam) })}`)
      if (!response?.ok) throw new Error('Unavailable')
      return (await response.json()) as { total: number; rows: Stored[] }
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + page.rows.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
  const rows = pages.data?.pages.flatMap((page) => page.rows) ?? []
  const total = pages.data?.pages[0]?.total
  return (
    <Section title={t.browse} description={t.browseHint}>
      <div className="flex items-center gap-3 border-b p-3">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t.browseSearch} aria-label={t.browseSearch} className="pl-8" />
        </div>
        {total !== undefined && <span className="shrink-0 text-sm text-muted-foreground">{t.browseCount(total)}</span>}
      </div>
      <div className="max-h-[32rem] divide-y overflow-y-auto">
        {rows.map((song) => (
          <StoredRow
            key={song.id}
            song={song}
            note={song.data === null ? t.noCredits : [song.meta?.edited || song.meta?.picked ? t.edited : '', song.data?.artists.length ? song.data.artists.join(', ') : ''].filter(Boolean).join(' · ')}
            onOpen={onOpen}
          />
        ))}
        {pages.hasNextPage && (
          <div className="p-3 text-center">
            <Button variant="ghost" size="sm" disabled={pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>
              {t.more}
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}

/** Administration: the tasks that fill in the library from outside (they run on the Lumio server), and their results. */
export function MetadataPage() {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const isAdmin = useIsAdmin()
  const config = useLumioConfig().data ?? {}
  const save = useSaveConfig()
  const views = (useUserViews().data ?? []).filter((view) => MUSIC_TYPES.has(view.CollectionType ?? 'mixed'))
  const excluded = config.metadataExcludedLibraries ?? []
  const libraries = views.filter((view) => !excluded.includes(view.Id!)).map((view) => view.Id!)
  const [opened, setOpened] = useState<Opened | null>(null)
  const credits = useJob('credits', isAdmin)
  const missing = useQuery({
    queryKey: ['credits-missing'],
    enabled: isAdmin,
    // Grows while the songs are looked up.
    refetchInterval: () => (credits.data?.running ? 10_000 : false),
    queryFn: async () => {
      const response = await lumioGet('/admin/credits-missing')
      if (!response?.ok) throw new Error('Unavailable')
      return (await response.json()) as Stored[]
    },
  })

  if (!isAdmin) {
    return (
      <SettingsPage title={t.title}>
        <p className="text-sm text-muted-foreground">{t.adminOnly}</p>
      </SettingsPage>
    )
  }

  const toggleLibrary = (id: string, included: boolean) =>
    save.mutate((current) => {
      const list = new Set(current.metadataExcludedLibraries ?? [])
      if (included) list.delete(id)
      else list.add(id)
      return { ...current, metadataExcludedLibraries: [...list] }
    })

  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.libraries} description={t.librariesHint}>
        {views.map((view) => (
          <SwitchField
            key={view.Id}
            id={`metadata-library-${view.Id}`}
            label={view.Name ?? ''}
            checked={!excluded.includes(view.Id!)}
            disabled={save.isPending}
            onChange={(included) => toggleLibrary(view.Id!, included)}
          />
        ))}
      </Section>

      <JobSection name="credits" title={t.credits} hint={t.creditsHint} start={t.creditsStart} secondsEach={3} libraries={libraries} onOpen={setOpened} />
      {!!missing.data?.length && (
        <Section title={t.missingTitle(missing.data.length)} description={t.missingHint}>
          <div className="max-h-96 divide-y overflow-y-auto">
            {missing.data.map((song) => (
              <StoredRow key={song.id} song={song} note={t.lookedUp(new Date(song.at).toLocaleDateString(locale, { dateStyle: 'medium' }))} onOpen={setOpened} />
            ))}
          </div>
        </Section>
      )}
      <JobSection name="artists" title={t.artists} hint={t.artistsHint} start={t.artistsStart} secondsEach={5} libraries={libraries} onOpen={setOpened} />

      <BrowseSection onOpen={setOpened} />

      <TrackMetadataDialog
        key={opened?.kind === 'track' ? opened.id : 'track'}
        id={opened?.kind === 'track' ? opened.id : null}
        meta={opened?.kind === 'track' ? opened.meta : {}}
        error={opened?.kind === 'track' ? opened.error : undefined}
        onClose={() => setOpened(null)}
      />
      <ArtistMetadataDialog
        key={opened?.kind === 'artist' ? opened.id : 'artist'}
        id={opened?.kind === 'artist' ? opened.id : null}
        name={opened?.kind === 'artist' ? opened.name : ''}
        error={opened?.kind === 'artist' ? opened.error : undefined}
        onClose={() => setOpened(null)}
      />
    </SettingsPage>
  )
}
