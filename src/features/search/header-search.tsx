import { IconLoader2, IconPlayerPlayFilled, IconSearch, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { Button } from '@/components/ui/button'
import { useAuthedSession } from '@/features/auth/session'
import { useSearch } from '@/features/items/queries'
import { usePodcastSearch } from '@/features/listen/podcasts'
import { portraitImageUrl } from '@/lib/images'
import { itemHref, SQUARE_TYPES } from '@/lib/item-links'
import { inMode, useAppMode } from '@/lib/app-mode'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { searchMessages, typeLabels } from './messages'
import { canPlay, usePlayResult } from './play-result'
import { useRecentSearches, type SearchEntry } from './recent-searches'

const TYPE_ORDER = ['Movie', 'Series', 'BoxSet', 'MusicArtist', 'MusicAlbum', 'Playlist', 'AudioBook', 'Book', 'Episode', 'Audio']
const DEBOUNCE_MS = 200
const MAX_RESULTS = 8

/** Podcasts shown in the short list, after the library's results. */
const MAX_PODCASTS = 3

/**
 * Search field that lives in the navbar and shows results right below it. On the search page it is the page's own
 * field: typing there updates the results on the page instead of opening the short list. Watch shows it as an icon that opens the
 * field; Listen keeps it always open in the middle of its header, as music apps do (`persistent`).
 */
export function HeaderSearch({ persistent = false }: { persistent?: boolean }) {
  const mode = useAppMode()
  const { api, session } = useAuthedSession()
  const recent = useRecentSearches(session.userId, mode)
  const playResult = usePlayResult()
  const t = useMessages(searchMessages)
  const types: Record<string, string> = useMessages(typeLabels)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const searchPath = inMode(mode, '/search')
  const onSearchPage = pathname === searchPath
  const urlTerm = onSearchPage ? (params.get('q') ?? '') : ''
  // Open state is tied to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = persistent || onSearchPage || openOn === pathname
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null)
  const [value, setValue] = useState('')
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // On the search page the field shows the page's term (also when it changes by back/forward or a link).
  // Starts unset, so the very first render already takes the term over (a search page opened by its address).
  const [seenUrlTerm, setSeenUrlTerm] = useState<string | null>(null)
  if (onSearchPage && urlTerm !== seenUrlTerm) {
    setSeenUrlTerm(urlTerm)
    if (urlTerm !== value.trim()) setValue(urlTerm)
  }

  const listing = !onSearchPage
  const results = useSearch(listing ? term : '', mode)
  const podcasts = usePodcastSearch(listing && mode === 'listen' ? term : '')
  // Whole titles first; episodes and tracks would otherwise crowd the short list.
  const items = [...(results.data ?? [])]
    .sort((a, b) => TYPE_ORDER.indexOf(a.Type ?? '') - TYPE_ORDER.indexOf(b.Type ?? ''))
    .slice(0, MAX_RESULTS)
  const resultEntries: SearchEntry[] = [
    ...items.map((item) => ({
      target: { kind: 'item' as const, id: item.Id!, type: item.Type ?? '' },
      key: item.Id!,
      href: itemHref(item),
      title: item.Name ?? '',
      meta: [types[item.Type ?? ''], item.Type === 'Episode' ? item.SeriesName : item.Type === 'MusicAlbum' ? item.AlbumArtist : item.ProductionYear].filter(Boolean).join(' · '),
      image: portraitImageUrl(api, item, { fillHeight: 120 }),
      shape: item.Type === 'MusicArtist' ? ('round' as const) : SQUARE_TYPES.has(item.Type ?? '') || item.Type === 'Playlist' ? ('square' as const) : ('poster' as const),
    })),
    ...(podcasts.data ?? []).slice(0, MAX_PODCASTS).map((podcast) => ({
      target: { kind: 'podcast' as const, id: podcast.id },
      key: `podcast:${podcast.id}`,
      href: `/listen/podcast/${podcast.id}`,
      title: podcast.name,
      meta: [t.podcast, podcast.author].join(' · '),
      image: podcast.image,
      shape: 'square' as const,
    })),
  ]
  const loading = results.isLoading || (mode === 'listen' && podcasts.isLoading)
  // An empty field lists the recent searches instead (as in Spotify).
  const showingRecent = value.trim().length === 0
  const entries = showingRecent ? recent.entries : resultEntries

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(value.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [value])

  // On the search page, typing updates the page's results (after a short pause, so the address isn't rewritten on
  // every key).
  useEffect(() => {
    if (!onSearchPage || value.trim() === urlTerm) return
    const timer = window.setTimeout(() => {
      setSeenUrlTerm(value.trim())
      void navigate(`${searchPath}${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`, { replace: true })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [onSearchPage, value, urlTerm, searchPath, navigate])

  // Arriving on an empty search page puts the cursor in the field.
  useEffect(() => {
    if (onSearchPage && !urlTerm) input.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSearchPage])

  const close = () => {
    setOpen(false)
    setActive(-1)
  }

  const choose = (entry: SearchEntry) => {
    recent.add(entry)
    void navigate(entry.href, { viewTransition: true })
    close()
  }
  const play = (entry: SearchEntry) => {
    recent.add(entry)
    void playResult(entry.target)
    // Videos open the player; music keeps the list open to pick more.
    if (entry.target.kind === 'item' && !['MusicArtist', 'MusicAlbum', 'Audio', 'Playlist'].includes(entry.target.type)) close()
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenOn(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // "/" opens the search from anywhere that isn't a text field.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || target.closest('input, textarea, select, [contenteditable]') || event.metaKey || event.ctrlKey) return
      event.preventDefault()
      setOpenOn(pathname)
      input.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pathname])

  // The persistent field is always there; focusing it on every page would steal the keyboard.
  useEffect(() => {
    if (open && !persistent) input.current?.focus()
  }, [open, persistent])

  const showAll = () => {
    if (!value.trim()) return
    void navigate(inMode(mode, `/search?q=${encodeURIComponent(value.trim())}`), { viewTransition: true })
    close()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close()
      input.current?.blur()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, entries.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (onSearchPage) return input.current?.blur()
      const chosen = entries[active]
      if (chosen) choose(chosen)
      else showAll()
    }
  }

  // The persistent field shows results only while it is being used.
  const [focused, setFocused] = useState(false)
  const panelVisible =
    listing && open && (showingRecent ? recent.entries.length > 0 : term.length > 0) && (!persistent || focused || openOn === pathname)

  return (
    <div ref={root} className={cn('relative flex items-center', persistent && 'w-full max-w-md')}>
      {!open ? (
        <Button variant="ghost" size="icon" aria-label={t.search} title={t.searchShortcut} onClick={() => setOpen(true)}>
          <IconSearch />
        </Button>
      ) : (
        <div className={cn('relative', persistent ? 'w-full' : 'animate-page-in')}>
          {/* Above the field: its focused background is opaque and would hide the icon. */}
          <IconSearch
            className={cn(
              'pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground',
              persistent ? 'left-4 size-5' : 'left-2.5 size-4',
            )}
          />
          <input
            ref={input}
            role="combobox"
            aria-expanded={panelVisible}
            aria-controls="header-search-results"
            aria-activedescendant={active >= 0 ? `search-result-${active}` : undefined}
            aria-label={t.search}
            autoComplete="off"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setActive(-1)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={persistent ? t.placeholderListen : t.placeholder}
            className={cn(
              'outline-none transition-[background-color,box-shadow] placeholder:text-muted-foreground',
              persistent
                ? 'h-11 w-full rounded-full bg-surface pl-12 pr-10 text-[15px] hover:bg-surface-hover hover:shadow-[inset_0_0_0_1px_var(--color-muted-foreground)] focus-visible:bg-surface-hover focus-visible:shadow-[inset_0_0_0_2px_var(--color-foreground)]'
                : 'h-9 w-52 rounded-lg border border-input bg-background/80 pl-8 pr-8 text-sm backdrop-blur focus-visible:border-foreground/35 focus-visible:bg-background sm:w-72',
            )}
          />
          {((!persistent && !onSearchPage) || value) && (
          <button
            type="button"
            aria-label={t.close}
            onClick={() => {
              setValue('')
              close()
            }}
            className={cn(
              'absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground',
              persistent ? 'right-2.5 size-7' : 'right-1.5 size-6',
            )}
          >
            <IconX className={persistent ? 'size-5' : 'size-4'} />
          </button>
          )}
        </div>
      )}

      {panelVisible && (
        <div
          id="header-search-results"
          role="listbox"
          aria-label={showingRecent ? t.recent : undefined}
          // Pressing on a result would take the focus from the field first, which hides the list before the click
          // lands; keeping the focus lets the click through.
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            'absolute top-full z-50 mt-2 max-h-[70svh] overflow-y-auto rounded-xl bg-popover p-2 shadow-2xl ring-1 ring-foreground/5 [scrollbar-width:thin]',
            persistent ? 'inset-x-0' : 'right-0 w-[min(26rem,calc(100vw-2rem))]',
          )}
        >
          {showingRecent && <p className="px-2 pb-2 pt-1 text-sm font-bold">{t.recent}</p>}
          {!showingRecent && loading && !entries.length && (
            <div className="grid place-items-center py-6 text-muted-foreground">
              <IconLoader2 className="size-5 animate-spin" />
            </div>
          )}
          {!showingRecent && !loading && entries.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{t.noResults(term)}</p>}
          {entries.map((entry, index) => (
            <ResultRow
              key={entry.key}
              index={index}
              entry={entry}
              active={index === active}
              onHover={() => setActive(index)}
              onChoose={() => choose(entry)}
              onPlay={canPlay(entry.target) ? () => play(entry) : undefined}
              onRemove={showingRecent ? () => recent.remove(entry.key) : undefined}
            />
          ))}
          {!showingRecent && entries.length > 0 && (
            <button
              type="button"
              onClick={showAll}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
            >
              {t.showAll(term)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One result: a click opens it; the cover turns into a play button on hover (as in Spotify), and recent searches get
 * an "×" to forget them.
 */
function ResultRow({
  index,
  entry,
  active,
  onHover,
  onChoose,
  onPlay,
  onRemove,
}: {
  index: number
  entry: SearchEntry
  active: boolean
  onHover: () => void
  onChoose: () => void
  onPlay?: () => void
  onRemove?: () => void
}) {
  const t = useMessages(searchMessages)
  const shape = entry.shape === 'poster' ? 'aspect-[2/3] rounded' : entry.shape === 'round' ? 'aspect-square rounded-full' : 'aspect-square rounded'
  return (
    <div
      id={`search-result-${index}`}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      className={cn('group/result relative flex items-center rounded-md transition-colors', active ? 'bg-foreground/10' : 'hover:bg-foreground/[0.07]')}
    >
      <Link
        to={entry.href}
        viewTransition
        // Arrow keys move through the options from the input (aria-activedescendant); Tab leaves the search.
        tabIndex={-1}
        onClick={(event) => {
          event.preventDefault()
          onChoose()
        }}
        className="flex min-w-0 flex-1 items-center gap-3 p-2 pr-10 outline-none"
      >
        <div className={cn('w-11 shrink-0 overflow-hidden bg-muted', shape)}>
          {entry.image && <FadeImage src={entry.image} alt="" className="size-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{entry.title}</p>
          <p className="truncate text-sm text-muted-foreground">{entry.meta}</p>
        </div>
      </Link>
      {onPlay && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t.play(entry.title)}
          title={t.play(entry.title)}
          onClick={onPlay}
          className={cn(
            'absolute left-2 top-1/2 grid w-11 -translate-y-1/2 place-items-center bg-black/50 text-white opacity-0 transition-opacity group-hover/result:opacity-100',
            shape,
          )}
        >
          <IconPlayerPlayFilled className="size-5" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t.removeRecent(entry.title)}
          title={t.removeRecent(entry.title)}
          onClick={onRemove}
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/result:opacity-100"
        >
          <IconX className="size-4" />
        </button>
      )}
    </div>
  )
}
