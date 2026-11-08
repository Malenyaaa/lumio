import { IconBook, IconBooks, IconHome, IconHomeFilled, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconMicrophone, IconMusic, IconSearch, IconTicket, type Icon } from '@tabler/icons-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { BackButton, HeaderActions, PhoneLead, SettingsEffects } from '@/components/app-shell'
import { PhoneMiniPlayer } from '@/components/mobile/phone-mini-player'
import { TabBar, type Tab } from '@/components/mobile/tab-bar'
import { AppBrand } from '@/components/app-switcher'
import { PageTransition } from '@/components/page-transition'
import { useSession } from '@/features/auth/session'
import { HeaderSearch } from '@/features/search/header-search'
import { LEFT_LIMITS, PEEK_WIDTH, RIGHT_LIMITS, setListenLayout, setListenPanelExpanded, useListenLayout, useListenPanel, useListenPanelPeek } from './player/panel'
import { SongInfoHost } from './player/now-playing'
import { PlayerBar } from './player/player-bar'
import { ListenControlsProvider } from './player/player-controls'
import { SidePanel } from './player/side-panel'
import { concertsAvailable } from './concerts'
import { LibrarySidebar } from './library-sidebar'
import { ResizeHandle } from './resize-handle'
import { useCategories, type CategoryId } from '@/features/library/categories'
import { useLocalSettings } from '@/features/settings/local-settings'
import { rememberMode, rememberPath } from '@/lib/app-mode'
import { markAppReady } from '@/lib/boot'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const messages = defineMessages({
  de: {
    home: 'Start',
    podcasts: 'Podcasts',
    concerts: 'Konzerte',
    library: 'Bibliothek',
    navigation: 'Listen-Navigation',
    collapse: 'Bibliothek einklappen',
    expand: 'Bibliothek ausklappen',
    resizeLibrary: 'Breite der Bibliothek ändern',
    search: 'Suchen',
  },
  en: {
    home: 'Home',
    podcasts: 'Podcasts',
    concerts: 'Concerts',
    library: 'Library',
    navigation: 'Listen navigation',
    collapse: 'Collapse library',
    expand: 'Expand library',
    resizeLibrary: 'Resize library',
    search: 'Search',
  },
})

const CATEGORY_ICONS: Partial<Record<CategoryId, Icon>> = { music: IconMusic, audiobooks: IconBook }

/** The pages the Library tab covers on phones (the sidebar's place on wider screens). */
const LIBRARY_PAGES = ['/listen/browse/', '/listen/podcasts', '/listen/concerts', '/listen/liked', '/listen/playlist/', '/listen/episodes']

/**
 * Listen's frame, built for audio rather than for cinema: a library sidebar on the left (like Spotify or Apple Music),
 * the content beside it, and the header with search and profile on top. Watch's frame stays as it is.
 */
export function ListenShell() {
  const { session } = useSession()
  if (!session) return <Navigate to="/login" replace />
  return <ListenEntry />
}

/** Signed in: the device's settings (kept per user) decide whether Listen opens at all. */
function ListenEntry() {
  const { settings } = useLocalSettings()
  // Listen switched off on this device.
  if (settings.apps === 'watch') return <Navigate to="/" replace />
  return <SignedInListen />
}

function SignedInListen() {
  const t = useMessages(messages)
  const { pathname, search } = useLocation()
  const { categories, isLoading } = useCategories('listen')
  // The player bar and the side panel take room from the content while something is loaded.
  const panel = useListenPanel()
  const layout = useListenLayout()
  const leftWidth = panel.expanded ? 0 : layout.collapsed ? LEFT_LIMITS.collapsed : layout.left
  const peek = useListenPanelPeek()
  // Folded, the panel peeks out a little while pointed at; the content moves over for it (corners and all).
  const rightWidth = panel.open ? layout.right : peek ? PEEK_WIDTH : RIGHT_LIMITS.collapsed
  // Width at the start of a drag; the handle reports how far it moved since.
  const dragFrom = useRef(0)

  const tabs: Tab[] = [
    { to: '/listen', label: t.home, icon: IconHome, activeIcon: IconHomeFilled, end: true },
    { to: '/listen/search', label: t.search, icon: IconSearch },
    { to: '/listen/library', label: t.library, icon: IconBooks, match: (path) => LIBRARY_PAGES.some((page) => path.startsWith(page)) },
  ]

  useEffect(() => rememberMode('listen'), [])
  useEffect(() => rememberPath('listen', `${pathname}${search}`), [pathname, search])
  // The start page lifts the boot screen itself once its rows are there; other pages as soon as the frame is complete.
  useEffect(() => {
    if (!isLoading && pathname !== '/listen') markAppReady()
  }, [isLoading, pathname])

  const links: Array<{ to: string; label: string; icon: Icon; end?: boolean }> = [
    { to: '/listen', label: t.home, icon: IconHome, end: true },
  ]
  const library = [
    ...categories.map((category) => ({
      to: `/listen/browse/${category.id}`,
      label: category.label,
      icon: CATEGORY_ICONS[category.id] ?? IconMusic,
    })),
    // Not from the server's libraries: podcasts from Apple's directory, concerts from Ticketmaster.
    { to: '/listen/podcasts', label: t.podcasts, icon: IconMicrophone },
    ...(concertsAvailable() ? [{ to: '/listen/concerts', label: t.concerts, icon: IconTicket }] : []),
  ]

  return (
    <div
      data-app-shell
      data-mode="listen"
      // Panels on a darker ground, as in Spotify: the frame (header, sidebar, player bar) sits on the deepest tone.
      className="min-h-svh bg-background dark:[--background:oklch(0.1_0_0)]"
      // The frame's measurements, used by the sidebar, header, content and side panel alike.
      style={{ '--listen-left': `${leftWidth}px`, '--listen-right': `${rightWidth}px` } as CSSProperties}
    >
      <aside
        aria-label={t.navigation}
        className={cn(
          'fixed left-0 top-0 z-40 hidden w-(--listen-left) flex-col gap-2 bg-background p-2 pr-0 transition-[width] duration-300 ease-out md:flex [.cursor-col-resize_&]:transition-none',
          'bottom-20',
          layout.collapsed && 'items-center px-2',
          // The big side panel takes the whole window; the library steps aside.
          panel.expanded && 'invisible overflow-hidden',
        )}
      >
        <div className={cn('flex h-11 items-center gap-1', layout.collapsed ? 'justify-center' : 'justify-between px-2')}>
          {/* May shrink (the name truncates) so a narrow sidebar never pushes the fold button out. */}
          {!layout.collapsed && <AppBrand mode="listen" className="min-w-0 shrink" collapsibleName />}
          <button
            type="button"
            aria-label={layout.collapsed ? t.expand : t.collapse}
            title={layout.collapsed ? t.expand : t.collapse}
            onClick={() => setListenLayout({ collapsed: !layout.collapsed })}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {layout.collapsed ? <IconLayoutSidebarLeftExpand className="size-5" /> : <IconLayoutSidebarLeftCollapse className="size-5" />}
          </button>
        </div>
        {/* Start and the kinds of audio (music, audiobooks) up top; below, the user's own library. */}
        <nav className={cn('space-y-0.5 rounded-xl bg-surface p-2', layout.collapsed && 'w-full px-0')}>
          {[...links, ...library].map((link) => (
            <SideLink key={link.to} {...link} compact={layout.collapsed} />
          ))}
        </nav>
        <LibrarySidebar compact={layout.collapsed} />
        {/* Dragging narrower than the minimum folds it to icons; dragging out again unfolds it. */}
        <ResizeHandle
          edge="right"
          label={t.resizeLibrary}
          onDragStart={() => (dragFrom.current = leftWidth)}
          onDrag={(delta) => {
            const width = dragFrom.current + delta
            if (width < (LEFT_LIMITS.min + LEFT_LIMITS.collapsed) / 2) setListenLayout({ collapsed: true })
            else setListenLayout({ collapsed: false, left: Math.min(LEFT_LIMITS.max, Math.max(LEFT_LIMITS.min, width)) })
          }}
          onDoubleClick={() => setListenLayout({ collapsed: !layout.collapsed })}
        />
      </aside>

      <header className="[view-transition-name:app-header] fixed inset-x-0 top-0 z-30 box-content flex h-14 items-center justify-between gap-4 bg-background/90 px-4 pt-(--safe-top) backdrop-blur transition-[left] duration-300 ease-out sm:px-8 md:left-(--listen-left) [.cursor-col-resize_&]:transition-none">
        <div className="flex min-w-0 items-center gap-3">
          {/* Phones have no sidebar: the profile menu (or back) and the brand; the library is a tab. */}
          <div className="contents md:hidden">
            <PhoneLead tabs={tabs} />
            <AppBrand mode="listen" />
          </div>
          <div className="hidden md:block">
            <BackButton />
          </div>
        </div>
        {/* Always open in the middle, as in music apps: searching is how most listening starts. */}
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 sm:flex">
          {/* Home right beside the search, as in Spotify: the two ways most listening starts. */}
          <NavLink
            to="/listen"
            end
            // Home also shrinks the big side panel back to the side.
            onClick={() => setListenPanelExpanded(false)}
            aria-label={t.home}
            title={t.home}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-muted-foreground outline-none transition-[color,background-color,scale] hover:scale-105 hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground"
          >
            {({ isActive }) => (isActive ? <IconHomeFilled className="size-6" /> : <IconHome className="size-6" />)}
          </NavLink>
          <HeaderSearch persistent />
        </div>
        <HeaderActions search={false} />
      </header>

      {/*
        The content scrolls in a rounded panel of its own between sidebar, header, side panel and player bar. Inside it,
        "the background" is the panel's tone, so pages fading into it match. Pages leave room for a header they would
        sit under elsewhere; here the header is outside, so that room is scrolled away (-mt-14).
      */}
      {/* On phones it fills the width and scrolls on under the tabs and the player (which fade over it). */}
      <main
        data-scroll-root
        className={cn(
          'fixed inset-x-0 top-[calc(3.5rem+var(--safe-top))] bottom-0 overflow-y-auto overflow-x-hidden bg-surface [--background:var(--surface)] [scrollbar-width:thin]',
          'md:bottom-22 md:left-[calc(var(--listen-left)+0.5rem)] md:right-2 md:top-14 md:rounded-xl lg:right-[calc(var(--listen-right)+0.5rem)]',
          'transition-[left,right] duration-300 ease-out [.cursor-col-resize_&]:transition-none',
        )}
      >
        <div className="-mt-14 pb-[calc(var(--bottom-inset)+2rem)] md:pb-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      {/* This device's player, or the one Lumio controls: the side panel and the bar follow either. */}
      <ListenControlsProvider>
        <SidePanel />
        <PlayerBar />
        <PhoneMiniPlayer />
        <SongInfoHost />
      </ListenControlsProvider>
      <TabBar tabs={tabs} pathname={pathname} />

      <SettingsEffects />
    </div>
  )
}

function SideLink({ to, label, icon: Icon, end, compact }: { to: string; label: string; icon: Icon; end?: boolean; compact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      // Folded to icons, the name moves into the tooltip and the accessible name.
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
          // Folded: a square tile around the icon, centred, rather than a bar stretched across the strip.
          compact ? 'mx-auto size-11 justify-center p-0' : 'px-3',
          isActive ? 'bg-muted text-foreground' : 'text-foreground/70',
        )
      }
    >
      <Icon className="size-5 shrink-0" />
      {!compact && label}
    </NavLink>
  )
}
