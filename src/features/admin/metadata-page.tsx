import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@/components/link'
import { Button } from '@/components/ui/button'
import { useItem } from '@/features/items/queries'
import { Section, SettingsPage } from '@/features/settings/fields'
import { lumioGet, lumioSend } from '@/features/social/social'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { useIsAdmin } from './use-admin-config'

const messages = defineMessages({
  de: {
    title: 'Musik-Metadaten',
    description:
      'Lumio ergänzt die Bibliothek um Angaben von außen. Was gespielt oder geöffnet wird, schlägt Lumio von selbst nach; hier lässt sich alles auf einmal erledigen. Die Aufgaben laufen auf dem Lumio-Server weiter, auch wenn du die Seite verlässt.',
    adminOnly: 'Nur für Administrator*innen.',
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
    failedHint: 'Hier hat ein Dienst nicht geantwortet. Diese Einträge werden beim nächsten Durchlauf erneut versucht.',
    missingTitle: (n: number) => `Songs nicht gefunden (${n})`,
    missingHint:
      'Für diese Songs gibt es auf MusicBrainz keine Aufnahme mit gleichem Titel, Künstler*in und ähnlicher Länge. Sie werden nach 30 Tagen erneut nachgeschlagen; mit sauberen Datei-Tags (etwa über MusicBrainz Picard) klappt es meist.',
    lookedUp: (when: string) => `nachgeschlagen ${when}`,
  },
  en: {
    title: 'Music metadata',
    description:
      "Lumio adds information from outside to the library. What plays or is opened is looked up on its own; here everything can be done at once. The tasks keep running on the Lumio server when you leave this page.",
    adminOnly: 'Administrators only.',
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
    failedHint: "A service didn't answer for these. They are tried again on the next run.",
    missingTitle: (n: number) => `Songs not found (${n})`,
    missingHint:
      'MusicBrainz has no recording with the same title, artist and a similar length for these songs. They are looked up again after 30 days; clean file tags (e.g. from MusicBrainz Picard) usually help.',
    lookedUp: (when: string) => `looked up ${when}`,
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

interface Missing {
  id: string
  at: number
  meta: { title?: string; artist?: string; album?: string; albumId?: string } | null
}

type JobName = 'credits' | 'artists'

/** A song or artist in the lists of misses, linking to its page where it is known. */
function EntryRow({ title, line, href }: { title?: string; line?: string; href?: string }) {
  const text = (
    <>
      <p className="truncate text-sm font-medium">{title || '—'}</p>
      {line && <p className="truncate text-xs text-muted-foreground">{line}</p>}
    </>
  )
  return href ? (
    <Link to={href} className="block px-4 py-2.5 transition-colors hover:bg-muted/50">
      {text}
    </Link>
  ) : (
    <div className="px-4 py-2.5">{text}</div>
  )
}

/** A song MusicBrainz had nothing for; names from Jellyfin for those looked up before Lumio kept them. */
function MissingRow({ song, note }: { song: Missing; note: string }) {
  const item = useItem(song.id, !song.meta).data
  const meta = song.meta ?? { title: item?.Name ?? undefined, artist: item?.Artists?.[0], album: item?.Album ?? undefined, albumId: item?.AlbumId ?? undefined }
  return <EntryRow title={meta.title} line={[meta.artist, meta.album, note].filter(Boolean).join(' · ')} href={meta.albumId ? `/listen/album/${meta.albumId}` : undefined} />
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
function JobSection({ name, title, hint, start, secondsEach }: { name: JobName; title: string; hint: string; start: string; secondsEach: number }) {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const client = useQueryClient()
  const state = useJob(name, true)
  const control = useMutation({
    mutationFn: async (method: 'POST' | 'DELETE') => {
      // The artist task asks Last.fm with the app's key, unless the server has its own.
      const body = name === 'artists' && method === 'POST' ? { lastfmKey: import.meta.env.VITE_LASTFM_API_KEY?.trim() } : undefined
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
            <Button disabled={control.isPending || !job} onClick={() => control.mutate('POST')}>
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
                href={name === 'artists' ? `/listen/artist/${entry.id}` : entry.albumId ? `/listen/album/${entry.albumId}` : undefined}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

/** Administration: the tasks that fill in the library from outside (they run on the Lumio server). */
export function MetadataPage() {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const isAdmin = useIsAdmin()
  const credits = useJob('credits', isAdmin)
  const missing = useQuery({
    queryKey: ['credits-missing'],
    enabled: isAdmin,
    // Grows while the songs are looked up.
    refetchInterval: () => (credits.data?.running ? 10_000 : false),
    queryFn: async () => {
      const response = await lumioGet('/admin/credits-missing')
      if (!response?.ok) throw new Error('Unavailable')
      return (await response.json()) as Missing[]
    },
  })

  if (!isAdmin) {
    return (
      <SettingsPage title={t.title}>
        <p className="text-sm text-muted-foreground">{t.adminOnly}</p>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage title={t.title} description={t.description}>
      <JobSection name="credits" title={t.credits} hint={t.creditsHint} start={t.creditsStart} secondsEach={3} />
      {!!missing.data?.length && (
        <Section title={t.missingTitle(missing.data.length)} description={t.missingHint}>
          <div className="max-h-96 divide-y overflow-y-auto">
            {missing.data.map((song) => (
              <MissingRow key={song.id} song={song} note={t.lookedUp(new Date(song.at).toLocaleDateString(locale, { dateStyle: 'medium' }))} />
            ))}
          </div>
        </Section>
      )}
      <JobSection name="artists" title={t.artists} hint={t.artistsHint} start={t.artistsStart} secondsEach={5} />
    </SettingsPage>
  )
}
