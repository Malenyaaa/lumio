import {
  IconCircleCheck,
  IconCircleCheckFilled,
  IconCirclePlus,
  IconDots,
  IconExternalLink,
  IconMicrophone,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlaylistAdd,
  IconSearch,
  IconTextPlus,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { ImageLightbox } from '@/components/media/image-lightbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthedSession } from '@/features/auth/session'
import { useDominantColor } from '@/lib/dominant-color'
import { externalOf } from '@/lib/external-items'
import { formatClock, formatRuntime, plainText } from '@/lib/format'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CardRow } from './music-card'
import { currentTrack, music, useMusic, useMusicTime } from './player/music-player'
import { playCircle } from './play-circle'
import {
  episodeFromItem,
  episodePath,
  PODCAST_GENRES,
  setEpisodeDone,
  toggleSavedEpisode,
  useContinueListening,
  useEpisodeExtras,
  useEpisodeSaved,
  useFollowedPodcasts,
  usePodcast,
  usePodcastProgress,
  usePodcastSearch,
  useSavedEpisodes,
  useTopPodcasts,
  type Episode,
  type Podcast,
} from './podcasts'
import { SavedEpisodesCover } from './playlist-cards'
import { useListenLibrary } from './playlists'
import { endTrackDrag, startTrackDrag } from './track-drag'
import { TrackContextMenu } from './track-menu'

const messages = defineMessages({
  de: {
    podcasts: 'Podcasts',
    podcast: 'Podcast',
    searchPlaceholder: 'Podcasts suchen',
    continue: 'Weiterhören',
    newEpisodes: 'Neue Folgen',
    yours: 'Deine Podcasts',
    top: 'Top-Podcasts',
    all: 'Alle',
    results: (term: string) => `Podcasts für „${term}“`,
    noResults: 'Keine Podcasts gefunden.',
    follow: 'Folgen',
    following: 'Gefolgt',
    episodes: 'Alle Folgen',
    episodeCount: (n: number) => (n === 1 ? '1 Folge' : `${n} Folgen`),
    playLatest: 'Neueste Folge abspielen',
    play: (name: string) => `${name} abspielen`,
    pause: (name: string) => `${name} pausieren`,
    left: (time: string) => `noch ${time}`,
    played: 'Gehört',
    markPlayed: 'Als gehört markieren',
    markUnplayed: 'Als nicht gehört markieren',
    addToQueue: 'Zur Warteschlange hinzufügen',
    playNext: 'Als Nächstes abspielen',
    more: (name: string) => `Weitere Optionen für ${name}`,
    apple: 'In Apple Podcasts öffnen',
    showMore: 'Mehr anzeigen',
    showLess: 'Weniger anzeigen',
    notFound: 'Dieser Podcast wurde nicht gefunden.',
    source: 'Podcasts aus dem Apple-Podcast-Verzeichnis.',
    episode: 'Podcast-Folge',
    episodeNotFound: 'Diese Folge wurde nicht gefunden.',
    notes: 'Folgenbeschreibung',
    chapters: 'Kapitel',
    chaptersFromNotes: 'Aus den Zeitangaben der Beschreibung.',
    transcript: 'Transkript',
    save: 'Zu deinen Folgen hinzufügen',
    unsave: 'Aus deinen Folgen entfernen',
    yourEpisodes: 'Gespeicherte Folgen',
    playlist: 'Playlist',
    noSavedEpisodes: 'Folgen, die du mit dem Plus speicherst, landen hier.',
  },
  en: {
    podcasts: 'Podcasts',
    podcast: 'Podcast',
    searchPlaceholder: 'Search podcasts',
    continue: 'Continue listening',
    newEpisodes: 'New episodes',
    yours: 'Your podcasts',
    top: 'Top podcasts',
    all: 'All',
    results: (term: string) => `Podcasts for “${term}”`,
    noResults: 'No podcasts found.',
    follow: 'Follow',
    following: 'Following',
    episodes: 'All episodes',
    episodeCount: (n: number) => (n === 1 ? '1 episode' : `${n} episodes`),
    playLatest: 'Play latest episode',
    play: (name: string) => `Play ${name}`,
    pause: (name: string) => `Pause ${name}`,
    left: (time: string) => `${time} left`,
    played: 'Played',
    markPlayed: 'Mark as played',
    markUnplayed: 'Mark as unplayed',
    addToQueue: 'Add to queue',
    playNext: 'Play next',
    more: (name: string) => `More options for ${name}`,
    apple: 'Open in Apple Podcasts',
    showMore: 'Show more',
    showLess: 'Show less',
    notFound: "This podcast couldn't be found.",
    source: 'Podcasts from the Apple Podcasts directory.',
    episode: 'Podcast episode',
    episodeNotFound: "This episode couldn't be found.",
    notes: 'Episode description',
    chapters: 'Chapters',
    chaptersFromNotes: 'From the timestamps in the description.',
    transcript: 'Transcript',
    save: 'Save episode',
    unsave: 'Remove from saved episodes',
    yourEpisodes: 'Saved episodes',
    playlist: 'Playlist',
    noSavedEpisodes: 'Episodes you save with the plus end up here.',
  },
})

/** A show as a card: its square artwork, name and who makes it. */
export function PodcastCard({ podcast, className }: { podcast: Podcast; className?: string }) {
  return (
    <Link
      to={`/listen/podcast/${podcast.id}`}
      className={cn('w-44 shrink-0 rounded-lg p-3 outline-none transition-colors duration-300 hover:bg-foreground/[0.07] focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      <div className="aspect-square overflow-hidden rounded-md bg-muted shadow-lg shadow-black/40">
        {podcast.image ? (
          <FadeImage src={podcast.image} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <IconMicrophone className="size-1/3" stroke={1.25} />
          </div>
        )}
      </div>
      <p className="mt-3 truncate text-sm font-semibold">{podcast.name}</p>
      <p className="mt-0.5 truncate text-sm text-muted-foreground">{podcast.author}</p>
    </Link>
  )
}

/** Shows in a responsive grid. */
function PodcastGrid({ podcasts, loading }: { podcasts: Podcast[]; loading?: boolean }) {
  return (
    <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
      {loading && Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="m-3 aspect-square rounded-md" />)}
      {podcasts.map((podcast) => (
        <PodcastCard key={podcast.id} podcast={podcast} className="w-auto" />
      ))}
    </div>
  )
}

/** Shows matching a search, as a row (Listen's search page). */
export function PodcastSearchRow({ term }: { term: string }) {
  const t = useMessages(messages)
  const results = usePodcastSearch(term)
  if (!results.isLoading && !results.data?.length) return null
  return (
    <CardRow title={t.podcasts} loading={results.isLoading}>
      {results.data?.map((podcast) => <PodcastCard key={podcast.id} podcast={podcast} />)}
    </CardRow>
  )
}

/** The user's followed shows, as a row (Listen's start page). */
export function FollowedPodcastsRow() {
  const t = useMessages(messages)
  const followed = useFollowedPodcasts()
  if (!followed.ids.length) return null
  return (
    <CardRow title={t.yours} loading={followed.isLoading && !followed.podcasts.length}>
      {followed.podcasts.map((podcast) => (
        <PodcastCard key={podcast.id} podcast={podcast} />
      ))}
    </CardRow>
  )
}

/**
 * Podcasts in Listen: a search over the whole directory, episodes the user started, the newest episodes of the
 * shows they follow, those shows, and the charts by category.
 */
export function PodcastsPage() {
  const t = useMessages(messages)
  const locale = useLocale()
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [genre, setGenre] = useState<string | undefined>()
  const search = usePodcastSearch(debounced)
  const top = useTopPodcasts(genre)
  const followed = useFollowedPodcasts()
  const continuing = useContinueListening()

  // Searches once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 350)
    return () => window.clearTimeout(timer)
  }, [term])
  const searching = debounced.trim().length > 1

  return (
    <div className="space-y-10 pb-12 pt-20">
      <div className="space-y-5 px-4 sm:px-8">
        <h1 className="text-4xl font-black tracking-tight">{t.podcasts}</h1>
        <div className="relative w-full max-w-md">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} className="h-10 rounded-full pl-9" />
        </div>
      </div>

      {searching ? (
        <section className="px-4 sm:px-8">
          <h2 className="mb-1 text-2xl font-bold tracking-tight">{t.results(debounced.trim())}</h2>
          <PodcastGrid podcasts={search.data ?? []} loading={search.isLoading} />
          {!search.isLoading && !search.data?.length && <p className="text-sm text-muted-foreground">{t.noResults}</p>}
        </section>
      ) : (
        <>
          {continuing.length > 0 && (
            <EpisodeSection title={t.continue} episodes={continuing.map((entry) => episodeFromItem(entry.item!, entry.duration)).filter((episode): episode is Episode => !!episode)} showPodcast />
          )}
          {followed.episodes.length > 0 && <EpisodeSection title={t.newEpisodes} episodes={followed.episodes.slice(0, 20)} showPodcast limit={5} />}
          <FollowedPodcastsRow />
          <section className="space-y-3 px-4 sm:px-8">
            <h2 className="text-2xl font-bold tracking-tight">{t.top}</h2>
            <div className="flex flex-wrap gap-2">
              {[{ id: undefined, label: t.all }, ...PODCAST_GENRES.map((entry) => ({ id: entry.id, label: entry[locale] }))].map((entry) => (
                <button
                  key={entry.id ?? 'all'}
                  type="button"
                  aria-pressed={genre === entry.id}
                  onClick={() => setGenre(entry.id)}
                  className={cn('rounded-full px-3 py-1.5 text-sm transition-colors', genre === entry.id ? 'bg-foreground text-background' : 'bg-foreground/10 hover:bg-foreground/20')}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <PodcastGrid podcasts={top.data ?? []} loading={top.isLoading} />
          </section>
        </>
      )}
      <p className="px-4 text-xs text-muted-foreground sm:px-8">{t.source}</p>
    </div>
  )
}

function EpisodeSection({ title, episodes, showPodcast, limit = 10 }: { title: string; episodes: Episode[]; showPodcast?: boolean; limit?: number }) {
  const t = useMessages(messages)
  const [all, setAll] = useState(false)
  return (
    <section className="px-4 sm:px-8">
      <h2 className="mb-3 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="max-w-4xl divide-y divide-border/60">
        {episodes.slice(0, all ? undefined : limit).map((episode) => (
          <EpisodeRow key={episode.guid} episode={episode} showPodcast={showPodcast} />
        ))}
      </div>
      {episodes.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-sm font-bold text-muted-foreground hover:text-foreground">
          {all ? t.showLess : t.showMore}
        </button>
      )}
    </section>
  )
}

/**
 * One episode, as podcast apps list them: artwork, date and title, the description (opens on click), and a play
 * button with how much is left, a progress bar once started, and a tick once heard.
 */
function EpisodeRow({ episode, showPodcast }: { episode: Episode; showPodcast?: boolean }) {
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const state = useMusic()
  const { position } = useMusicTime()
  const all = usePodcastProgress()
  const [open, setOpen] = useState(false)
  const isCurrent = externalOf(currentTrack(state))?.guid === episode.guid
  const saved = all[episode.guid]
  const done = !!saved?.done
  const at = isCurrent ? position : (saved?.position ?? 0)
  const duration = episode.seconds || saved?.duration || 0
  const started = at > 30 && !done
  const playing = isCurrent && state.playing
  const date = episode.published ? new Date(episode.published).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const description = plainText(episode.description)
  const podcastName = episode.item.Album ?? ''
  const savedEpisode = useEpisodeSaved(episode.guid)

  const play = () => (isCurrent ? music.toggle() : music.play([episode.item], 0, { source: `podcast:${episode.podcastId}` }))

  return (
    <TrackContextMenu track={episode.item}>
      <div
        draggable
        onDragStart={(event) => startTrackDrag(event, [episode.item])}
        onDragEnd={endTrackDrag}
        className="group/track flex gap-4 rounded-md px-2 py-4 transition-colors hover:bg-foreground/[0.04] data-popup-open:bg-foreground/[0.07]"
      >
        <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted sm:size-28">
          {episode.image && <FadeImage src={episode.image} alt="" loading="lazy" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {showPodcast && podcastName && (
            <Link to={`/listen/podcast/${episode.podcastId}`} className="block truncate text-sm text-muted-foreground hover:text-foreground hover:underline">
              {podcastName}
            </Link>
          )}
          <Link to={episodePath(episode.podcastId, episode.trackId)} className={cn('block font-semibold hover:underline', isCurrent && 'text-listen')}>
            {episode.title}
          </Link>
          {description && (
            // A click opens the rest of the description; the episode's page has it all, with chapters.
            <p onClick={() => setOpen(!open)} className={cn('cursor-pointer whitespace-pre-line break-words text-sm text-muted-foreground', !open && 'line-clamp-2')}>
              <Linkified text={description} />
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" aria-label={playing ? t.pause(episode.title) : t.play(episode.title)} onClick={play} className={cn('size-8 shrink-0', playCircle.light)}>
              {playing ? <IconPlayerPauseFilled className="size-4" /> : <IconPlayerPlayFilled className="size-4 translate-x-px" />}
            </button>
            <span className="text-xs text-muted-foreground">
              {date}
              {duration > 0 && ` · ${started || isCurrent ? t.left(formatRuntime((duration - at) * 10_000_000) ?? '') : formatRuntime(duration * 10_000_000)}`}
            </span>
            {(started || isCurrent) && duration > 0 && (
              <span className="h-1 w-24 overflow-hidden rounded-full bg-foreground/20">
                <span className="block h-full rounded-full bg-listen" style={{ width: `${Math.min(100, (at / duration) * 100)}%` }} />
              </span>
            )}
            {done && (
              <span className="flex items-center gap-1 text-xs font-medium text-listen">
                <IconCircleCheckFilled className="size-4" /> {t.played}
              </span>
            )}
            <span className="ml-auto flex items-center gap-0.5">
              <SaveEpisodeButton episode={episode} className="size-8 p-1.5" />
              <button
                type="button"
                aria-label={done ? t.markUnplayed : t.markPlayed}
                title={done ? t.markUnplayed : t.markPlayed}
                onClick={() => setEpisodeDone(episode.guid, episode.item, !done, duration)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/track:opacity-100"
              >
                {done ? <IconCircleCheckFilled className="size-5 text-listen" /> : <IconCircleCheck className="size-5" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t.more(episode.title)}
                  className="grid size-8 place-items-center rounded-full text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/track:opacity-100 data-popup-open:opacity-100"
                >
                  <IconDots className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => music.addToQueue([episode.item])}>
                    <IconPlaylistAdd /> {t.addToQueue}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => music.playNext([episode.item])}>
                    <IconTextPlus /> {t.playNext}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toggleSavedEpisode(episode.item)}>
                    <IconCirclePlus /> {savedEpisode ? t.unsave : t.save}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEpisodeDone(episode.guid, episode.item, !done, duration)}>
                    <IconCircleCheck /> {done ? t.markUnplayed : t.markPlayed}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
        </div>
      </div>
    </TrackContextMenu>
  )
}

/** Text with its web addresses as links (podcast descriptions carry show notes, sponsors and sources). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target="_blank" rel="noreferrer noopener" onClick={(event) => event.stopPropagation()} className="text-foreground underline underline-offset-2 hover:text-listen">
        {part.replace(/^https?:\/\/(www\.)?/, '')}
      </a>
    ) : (
      part
    ),
  )
}

/** A show's page: artwork tinted header, follow and play, and its episodes, newest first. */
export function PodcastPage() {
  const { id } = useParams()
  const t = useMessages(messages)
  const podcast = usePodcast(id)
  const library = useListenLibrary()
  const state = useMusic()
  const tint = useDominantColor(podcast.data?.podcast.image?.replace(/\/\d+x\d+bb\.jpg$/, '/64x64bb.jpg')).data
  const followKey = `podcast:${id}`
  const following = library.isSaved(followKey)

  if (podcast.isLoading)
    return (
      <div className="flex gap-6 px-4 pt-24 sm:px-8">
        <Skeleton className="size-48 rounded-md sm:size-56" />
        <div className="flex-1 space-y-4 pt-16">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    )
  if (!podcast.data) return <p className="p-8 pt-24 text-muted-foreground">{t.notFound}</p>

  const { podcast: show, episodes } = podcast.data
  const latest = episodes[0]
  const here = state.source === `podcast:${show.id}` && state.index >= 0

  return (
    <div className="pb-12">
      <div className="relative pt-14" style={{ background: `linear-gradient(to bottom, ${tint ?? 'rgb(64 64 64)'} 0%, transparent 100%)` }}>
        <div className="flex flex-col gap-6 px-4 pb-6 pt-10 sm:flex-row sm:items-end sm:px-8">
          <ImageLightbox
            // Apple serves the artwork in any size; the large view asks for a big one.
            src={show.image?.replace(/\/\d+x\d+bb\.jpg$/, '/1400x1400bb.jpg')}
            label={show.name}
            className="size-48 shrink-0 overflow-hidden rounded-md bg-muted shadow-2xl shadow-black/50 sm:size-56"
          >
            {show.image && <FadeImage src={show.image} alt="" className="size-full object-cover" />}
          </ImageLightbox>
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium">{t.podcast}</p>
            <h1 className="line-clamp-2 text-4xl font-black leading-none tracking-tight text-balance sm:text-6xl">{show.name}</h1>
            <p className="text-sm font-bold">{show.author}</p>
            <p className="text-sm text-foreground/70">{[show.genre, show.episodeCount ? t.episodeCount(show.episodeCount) : undefined].filter(Boolean).join(' • ')}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 px-4 py-5 sm:px-8">
        {latest && (
          <button
            type="button"
            aria-label={here && state.playing ? t.pause(show.name) : t.playLatest}
            title={t.playLatest}
            onClick={() => (here ? music.toggle() : music.play([latest.item], 0, { source: `podcast:${show.id}` }))}
            className={cn('size-14', playCircle.listen)}
          >
            {here && state.playing ? <IconPlayerPauseFilled className="size-6" /> : <IconPlayerPlayFilled className="size-6 translate-x-px" />}
          </button>
        )}
        <button
          type="button"
          aria-pressed={following}
          onClick={() => library.toggle(followKey)}
          className="h-8 rounded-full border border-foreground/40 px-4 text-sm font-bold transition-colors hover:border-foreground"
        >
          {following ? t.following : t.follow}
        </button>
        {show.url && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t.more(show.name)} className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <IconDots className="size-7" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem render={<a href={show.url} target="_blank" rel="noreferrer noopener" />}>
                <IconExternalLink /> {t.apple}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <EpisodeSection title={t.episodes} episodes={episodes} limit={30} />
    </div>
  )
}

/** Saves an episode to "Your episodes" or takes it out: a plus in a circle, a green tick once saved (as in Spotify). */
function SaveEpisodeButton({ episode, className }: { episode: Episode; className?: string }) {
  const t = useMessages(messages)
  const saved = useEpisodeSaved(episode.guid)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? t.unsave : t.save}
      title={saved ? t.unsave : t.save}
      onClick={() => toggleSavedEpisode(episode.item)}
      className={cn('grid place-items-center rounded-full transition-colors', saved ? 'text-listen' : 'text-muted-foreground hover:text-foreground', className)}
    >
      {saved ? <IconCircleCheckFilled className="size-full" /> : <IconCirclePlus className="size-full" />}
    </button>
  )
}

/** Where a click on a chapter or a transcript line leads: there in the episode, playing. */
function seekInEpisode(episode: Episode, seconds: number, isCurrent: boolean, playing: boolean) {
  if (isCurrent) {
    music.seek(seconds)
    if (!playing) music.toggle()
  } else music.play([episode.item], 0, { source: `podcast:${episode.podcastId}`, startAt: seconds })
}

/**
 * One episode on its own page: the artwork (opens large), title, show and date, play, save and mark as played, the
 * full show notes with working links, its chapters and its transcript where the show provides them. Chapters and the
 * current transcript line follow playback; clicking either jumps there.
 */
export function EpisodePage() {
  const { id, episodeId } = useParams()
  const t = useMessages(messages)
  const locale = getLocaleTag(useLocale())
  const podcast = usePodcast(id)
  const savedEpisodes = useSavedEpisodes()
  const progressAll = usePodcastProgress()
  const state = useMusic()
  const { position } = useMusicTime()
  const itemId = `podcast-episode-${episodeId}`
  // Apple lists a show's latest 200 episodes; older ones the user saved or started are still known from there.
  const known = savedEpisodes.find((item) => item.Id === itemId) ?? Object.values(progressAll).find((entry) => entry.item?.Id === itemId)?.item
  const episode = podcast.data?.episodes.find((entry) => entry.trackId === episodeId) ?? (known ? episodeFromItem(known) : undefined)
  const extras = useEpisodeExtras(episode, podcast.data?.podcast.feedUrl)
  const tint = useDominantColor(episode?.image?.replace(/\/\d+x\d+bb\.jpg$/, '/64x64bb.jpg')).data
  const transcriptBox = useRef<HTMLDivElement>(null)

  const isCurrent = !!episode && externalOf(currentTrack(state))?.guid === episode.guid
  const playing = isCurrent && state.playing
  const chapters = extras.data?.chapters ?? []
  const transcript = extras.data?.transcript ?? []
  let currentChapter = -1
  let currentCue = -1
  if (isCurrent) {
    chapters.forEach((chapter, index) => chapter.start <= position + 0.5 && (currentChapter = index))
    transcript.forEach((cue, index) => cue.start <= position + 0.3 && (currentCue = index))
  }

  // The transcript keeps the line being spoken in view (inside its own box, the page stays put).
  useEffect(() => {
    const box = transcriptBox.current
    const line = box?.querySelector<HTMLElement>(`[data-cue="${currentCue}"]`)
    if (!box || !line || currentCue < 0) return
    box.scrollTo({ top: line.offsetTop - box.clientHeight / 3, behavior: 'smooth' })
  }, [currentCue])

  if (podcast.isLoading && !episode)
    return (
      <div className="flex gap-6 px-4 pt-24 sm:px-8">
        <Skeleton className="size-48 rounded-md sm:size-56" />
        <div className="flex-1 space-y-4 pt-16">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    )
  if (!episode) return <p className="p-8 pt-24 text-muted-foreground">{t.episodeNotFound}</p>

  const saved = progressAll[episode.guid]
  const done = !!saved?.done
  const at = isCurrent ? position : (saved?.position ?? 0)
  const duration = episode.seconds || saved?.duration || 0
  const started = at > 30 && !done
  const date = episode.published ? new Date(episode.published).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const notes = extras.data?.notes ?? plainText(episode.description)
  const showName = podcast.data?.podcast.name ?? episode.item.Album ?? ''

  return (
    <div className="pb-12">
      <div className="relative pt-14" style={{ background: `linear-gradient(to bottom, ${tint ?? 'rgb(64 64 64)'} 0%, transparent 100%)` }}>
        <div className="flex flex-col gap-6 px-4 pb-6 pt-10 sm:flex-row sm:items-end sm:px-8">
          <ImageLightbox
            src={episode.image?.replace(/\/\d+x\d+bb\.jpg$/, '/1400x1400bb.jpg')}
            label={episode.title}
            className="size-48 shrink-0 overflow-hidden rounded-md bg-muted shadow-2xl shadow-black/50 sm:size-56"
          >
            {episode.image && <FadeImage src={episode.image} alt="" className="size-full object-cover" />}
          </ImageLightbox>
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium">{t.episode}</p>
            <h1 className="line-clamp-3 text-3xl font-black leading-tight tracking-tight text-balance sm:text-5xl">{episode.title}</h1>
            <Link to={`/listen/podcast/${episode.podcastId}`} className="block text-base font-bold hover:underline">
              {showName}
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-5 sm:px-8">
        <p className="text-sm text-muted-foreground">
          {date}
          {duration > 0 && ` · ${started || isCurrent ? t.left(formatRuntime((duration - at) * 10_000_000) ?? '') : formatRuntime(duration * 10_000_000)}`}
          {done && ` · ${t.played}`}
        </p>
        {(started || isCurrent) && duration > 0 && (
          <div className="h-1 w-64 max-w-full overflow-hidden rounded-full bg-foreground/20">
            <div className="h-full rounded-full bg-listen" style={{ width: `${Math.min(100, (at / duration) * 100)}%` }} />
          </div>
        )}
        <div className="flex items-center gap-5 pt-2">
          <button
            type="button"
            aria-label={playing ? t.pause(episode.title) : t.play(episode.title)}
            onClick={() => (isCurrent ? music.toggle() : music.play([episode.item], 0, { source: `podcast:${episode.podcastId}` }))}
            className={cn('size-14', playCircle.listen)}
          >
            {playing ? <IconPlayerPauseFilled className="size-6" /> : <IconPlayerPlayFilled className="size-6 translate-x-px" />}
          </button>
          <SaveEpisodeButton episode={episode} className="size-8" />
          <button
            type="button"
            aria-pressed={done}
            aria-label={done ? t.markUnplayed : t.markPlayed}
            title={done ? t.markUnplayed : t.markPlayed}
            onClick={() => setEpisodeDone(episode.guid, episode.item, !done, duration)}
            className={cn('grid size-8 place-items-center rounded-full transition-colors', done ? 'text-listen' : 'text-muted-foreground hover:text-foreground')}
          >
            {done ? <IconCircleCheckFilled className="size-8" /> : <IconCircleCheck className="size-8" stroke={1.5} />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t.more(episode.title)} className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <IconDots className="size-7" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem onClick={() => music.addToQueue([episode.item])}>
                <IconPlaylistAdd /> {t.addToQueue}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => music.playNext([episode.item])}>
                <IconTextPlus /> {t.playNext}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid max-w-6xl gap-10 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-10">
          {notes && (
            <section>
              <h2 className="mb-3 text-2xl font-bold tracking-tight">{t.notes}</h2>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/85">
                <Linkified text={notes} />
              </p>
            </section>
          )}
          {transcript.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl font-bold tracking-tight">{t.transcript}</h2>
              <div ref={transcriptBox} className="relative max-h-[28rem] space-y-3 overflow-y-auto rounded-xl bg-muted/50 p-5 [scrollbar-width:thin]">
                {transcript.map((cue, index) => (
                  <button
                    key={index}
                    type="button"
                    data-cue={index}
                    onClick={() => seekInEpisode(episode, cue.start, isCurrent, playing)}
                    className={cn(
                      'block w-full rounded-md px-2 py-1 text-left text-sm leading-relaxed transition-colors hover:bg-foreground/[0.06]',
                      index === currentCue ? 'bg-listen/10 text-foreground' : isCurrent && index < currentCue ? 'text-foreground/60' : 'text-foreground/85',
                    )}
                  >
                    <span className="mr-2 text-xs tabular-nums text-muted-foreground">{formatClock(cue.start)}</span>
                    {cue.speaker && <span className="mr-1 font-semibold">{cue.speaker}:</span>}
                    {cue.text}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
        {chapters.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight">{t.chapters}</h2>
            <ol className="space-y-0.5">
              {chapters.map((chapter, index) => (
                <li key={`${chapter.start}-${index}`}>
                  <button
                    type="button"
                    onClick={() => seekInEpisode(episode, chapter.start, isCurrent, playing)}
                    className={cn(
                      'flex w-full items-baseline gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-foreground/[0.07]',
                      index === currentChapter && 'bg-foreground/[0.07] text-listen',
                    )}
                  >
                    <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">{formatClock(chapter.start)}</span>
                    <span className="min-w-0 flex-1">{chapter.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            {extras.data?.chaptersFrom === 'description' && <p className="mt-2 px-2 text-xs text-muted-foreground">{t.chaptersFromNotes}</p>}
          </section>
        )}
      </div>
    </div>
  )
}

/** "Your episodes": the episodes the user saved, newest saved first (Liked Songs for podcasts). */
export function SavedEpisodesPage() {
  const t = useMessages(messages)
  const { session } = useAuthedSession()
  const saved = useSavedEpisodes()
  const episodes = saved.map((item) => episodeFromItem(item)).filter((episode): episode is Episode => !!episode)
  return (
    <div className="pb-12">
      <div className="relative pt-14" style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--color-listen) 40%, black) 0%, transparent 100%)' }}>
        <div className="flex flex-col gap-6 px-4 pb-6 pt-10 sm:flex-row sm:items-end sm:px-8">
          <div className="size-48 shrink-0 overflow-hidden rounded-md shadow-2xl shadow-black/50 sm:size-56">
            <SavedEpisodesCover />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium">{t.playlist}</p>
            <h1 className="text-5xl font-black leading-none tracking-tight sm:text-7xl">{t.yourEpisodes}</h1>
            <p className="text-sm text-foreground/80">
              <span className="font-bold text-foreground">{session.userName}</span> • {t.episodeCount(episodes.length)}
            </p>
          </div>
        </div>
      </div>
      <div className="pt-6">
        {episodes.length ? (
          <EpisodeSection title={t.episodes} episodes={episodes} showPodcast limit={50} />
        ) : (
          <p className="px-4 text-sm text-muted-foreground sm:px-8">{t.noSavedEpisodes}</p>
        )}
      </div>
    </div>
  )
}
