import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { FriendActivityButton } from '@/features/social/social-ui'
import { DownloadManagerButton, OfflineBadge } from '@/features/listen/download-manager'
import {
  IconAdjustments,
  IconArrowLeft,
  IconDeviceDesktop,
  IconBookmark,
  IconBookmarkFilled,
  IconDeviceMobile,
  IconDownload,
  IconExternalLink,
  IconHistory,
  IconHome,
  IconHomeFilled,
  IconLayoutGrid,
  IconLayoutGridFilled,
  IconLogout,
  IconMoon,
  IconSearch,
  IconServer,
  IconSettings,
  IconSun,
  IconUser,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { AppBrand } from '@/components/app-switcher'
import { Link } from '@/components/link'
import { shellMessages } from '@/components/messages'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PluginSlot, useHidden, usePluginRegistry } from '@/features/admin/plugins'
import { ConnectDeviceDialog } from '@/features/auth/connect-device-dialog'
import { useAuthedSession, useSession } from '@/features/auth/session'
import { useAncestors } from '@/features/items/queries'
import { categoryOf, categoryPath, useCategories } from '@/features/library/categories'
import { DeviceMenu } from '@/features/remote/device-menu'
import { SyncPlayMenu } from '@/features/remote/syncplay-menu'
import { MiniPlayer } from '@/features/listen/player/player-bar'
import { openPhonePlayer, setListenPanelExpanded, useListenPanel } from '@/features/listen/player/panel'
import { PhonePlayer } from '@/features/listen/player/phone-player'
import { HeaderSearch } from '@/features/search/header-search'
import { useLocalSettings } from '@/features/settings/local-settings'
import { useMessages } from '@/lib/i18n'
import { markAppReady } from '@/lib/boot'
import { inJellyfinApp, openAppSettings, openServerSelection } from '@/lib/native-app'
import { useAppPromoted } from '@/components/app-promo'
import { APP_DOWNLOAD_URL } from '@/lib/platform'
import { inMode, isLaunchAtRoot, lastMode, modeHome, rememberMode, rememberPath, useAppMode } from '@/lib/app-mode'
import { useTheme, useThemePreference, type ThemePreference } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { videoCacheAvailable } from '@/features/player/video-cache'
import { useAdminLinks, UserAvatar } from '@/components/account'
import { PhoneMiniPlayer } from '@/components/mobile/phone-mini-player'
import { ProfileDrawer } from '@/components/mobile/profile-drawer'
import { TabBar, type Tab } from '@/components/mobile/tab-bar'
import { ListenControlsProvider } from '@/features/listen/player/player-controls'

/**
 * One step back in the app's own history, like the browser's back button. Only shown where there is somewhere in the
 * app to go back to (not on the home screen, not on a page opened directly from outside).
 */
export function BackButton() {
  const navigate = useNavigate()
  const mode = useAppMode()
  const t = useMessages(shellMessages)
  // Listen's big side panel (lyrics, the cover) covers the page: "back" first shrinks it to the side again.
  const expanded = useListenPanel().expanded && mode === 'listen'
  const visible = useCanGoBack()
  // The slot is always there (empty when there is nowhere to go), so the logo and navigation never shift.
  return (
    <div className="-ml-2 size-9 shrink-0">
      {visible && (
        <Button variant="ghost" size="icon" aria-label={t.back} title={t.back} className="animate-in fade-in-0 duration-200" onClick={() => (expanded ? setListenPanelExpanded(false) : void navigate(-1))}>
          <IconArrowLeft />
        </Button>
      )}
    </div>
  )
}

/** Whether the back button has somewhere in the app to go (or Listen's big side panel to shrink). */
export function useCanGoBack() {
  const { pathname } = useLocation()
  const mode = useAppMode()
  // React Router numbers its history entries; 0 is the first page of this visit.
  const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const expanded = useListenPanel().expanded && mode === 'listen'
  return expanded || (pathname !== modeHome(mode) && index > 0)
}

/**
 * The phone header's left end: on a tab's own page the profile picture (opens the menu), deeper in the back arrow, as
 * in Spotify.
 */
export function PhoneLead({ tabs }: { tabs: Tab[] }) {
  const { pathname } = useLocation()
  const canGoBack = useCanGoBack()
  const onTab = tabs.some((tab) => tab.to === pathname)
  return onTab || !canGoBack ? <ProfileDrawer /> : <BackButton />
}

/** Guards routes that need a login but bring their own layout (e.g. the player). */
export function RequireSession() {
  const { session } = useSession()
  if (!session) return <Navigate to="/login" replace />
  return (
    <PageTransition>
      <Outlet />
    </PageTransition>
  )
}

/**
 * Which nav entry is current: a category, a library id (libraries outside the categories), 'home', 'watchlist' or
 * 'search'. Library and item pages belong to the category of their library.
 */
function useActiveSection(views: BaseItemDto[]): string | undefined {
  const { pathname } = useLocation()
  const category = useMatch('/browse/:category')
  const library = useMatch('/library/:id')
  const movie = useMatch('/movie/:id')
  const show = useMatch('/show/:id')
  const anyItem = useMatch('/item/:id')
  const item = movie ?? show ?? anyItem
  const ancestors = useAncestors(item?.params.id)

  if (pathname === '/') return 'home'
  if (pathname.startsWith('/watchlist')) return 'watchlist'
  if (pathname.startsWith('/downloads')) return 'downloads'
  if (pathname.startsWith('/search')) return 'search'
  if (category) return category.params.category
  const sectionOf = (view: BaseItemDto | undefined) => view && (categoryOf(view) ?? view.Id ?? undefined)
  if (library) return sectionOf(views.find((view) => view.Id === library.params.id))
  if (item) return sectionOf(views.find((view) => ancestors.data?.some((ancestor) => ancestor.Id === view.Id)))
  return undefined
}

function Nav() {
  const t = useMessages(shellMessages)
  const { navLinks, hidden } = usePluginRegistry()
  // By kind of media (Filme, Serien, Anime, …) rather than by library; libraries of other kinds keep their own entry.
  const { categories, others, all } = useCategories('watch')
  const active = useActiveSection(all)

  const entries: Array<{ key: string; to: string; label: string; external?: boolean }> = [
    ...(hidden.includes('nav:home') ? [] : [{ key: 'home', to: '/', label: t.home }]),
    ...categories.map((category) => ({ key: category.id, to: categoryPath(category.id), label: category.label })),
    ...others.map((view) => ({ key: view.Id!, to: `/library/${view.Id}`, label: view.Name ?? '' })),
    ...(hidden.includes('nav:watchlist') ? [] : [{ key: 'watchlist', to: '/watchlist', label: t.watchlist }]),
    // Films and episodes kept on this device (and what is left to play offline).
    ...(hidden.includes('nav:downloads') || !videoCacheAvailable ? [] : [{ key: 'downloads', to: '/downloads', label: t.downloads }]),
    ...navLinks.map((link) => ({ key: `plugin:${link.id}`, to: link.href, label: link.label, external: link.external })),
  ]

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      {entries.map((entry) => (
        <Link
          key={entry.key}
          to={entry.to}
          {...(entry.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          aria-current={entry.key === active ? 'page' : undefined}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
            entry.key === active ? 'bg-muted font-medium' : 'text-foreground/70',
          )}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  )
}

/** Menu entries for administrators only. */
function AdminMenuItems() {
  const t = useMessages(shellMessages)
  const links = useAdminLinks()
  if (!links.length) return null
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.administration}</DropdownMenuLabel>
      </DropdownMenuGroup>
      {links.map(({ key, label, icon: Icon, to, href, external }) => (
        <DropdownMenuItem key={key} render={to ? <Link to={to} /> : <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})} />}>
          <Icon /> {label}
          {external && <IconExternalLink className="ml-auto size-3.5 text-muted-foreground" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}


/** Applies device settings that affect the whole app rather than one page. */
export function SettingsEffects() {
  const { settings } = useLocalSettings()
  useEffect(() => {
    document.documentElement.classList.toggle('smooth-scroll', settings.smoothScrolling)
    return () => document.documentElement.classList.remove('smooth-scroll')
  }, [settings.smoothScrolling])
  useEffect(() => {
    document.documentElement.classList.toggle('no-page-animations', !settings.pageAnimations)
    return () => document.documentElement.classList.remove('no-page-animations')
  }, [settings.pageAnimations])
  return null
}

/** Signed out: straight to the login page, before anything that needs a session (user config, libraries…) runs. */
export function AppShell() {
  const { session } = useSession()
  if (!session) return <Navigate to="/login" replace />
  return <WatchEntry />
}

/** Signed in: the device's settings (kept per user) decide whether Watch opens at all. */
function WatchEntry() {
  const { pathname } = useLocation()
  const { settings } = useLocalSettings()
  // Watch switched off on this device, or Lumio opened fresh and Listen was used last: open Listen instead.
  if (settings.apps === 'listen' || (settings.apps === 'both' && isLaunchAtRoot(pathname) && lastMode() === 'listen')) {
    return <Navigate to="/listen" replace />
  }
  return <SignedInShell />
}

/** Watch's tabs on phones: start, search, the library (categories), the watchlist and what is downloaded. */
function useWatchTabs(): Tab[] {
  const t = useMessages(shellMessages)
  const { hidden } = usePluginRegistry()
  return [
    { to: '/', label: t.home, icon: IconHome, activeIcon: IconHomeFilled, end: true },
    { to: '/search', label: t.search, icon: IconSearch },
    {
      to: '/library',
      label: t.library,
      icon: IconLayoutGrid,
      activeIcon: IconLayoutGridFilled,
      match: (pathname) => pathname.startsWith('/browse/') || pathname.startsWith('/library/'),
    },
    ...(hidden.includes('nav:watchlist') ? [] : [{ to: '/watchlist', label: t.watchlist, icon: IconBookmark, activeIcon: IconBookmarkFilled }]),
    ...(hidden.includes('nav:downloads') || !videoCacheAvailable ? [] : [{ to: '/downloads', label: t.downloads, icon: IconDownload }]),
  ]
}

function SignedInShell() {
  const { session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const tabs = useWatchTabs()

  // Pages other than home lift the boot screen once the header (navigation) is complete; their content has skeletons.
  // Home waits for its hero instead (see home-page).
  const { pathname, search } = useLocation()
  const navReady = !useCategories().isLoading
  useEffect(() => {
    if (navReady && pathname !== '/') markAppReady()
  }, [navReady, pathname])

  // Lumio opens in the app used last, and switching back to Watch returns to this page.
  useEffect(() => rememberMode('watch'), [])
  useEffect(() => rememberPath('watch', `${pathname}${search}`), [pathname, search])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!session) return null

  return (
    <div data-app-shell data-mode="watch" className="min-h-svh">
      {/* In the desktop app it is also the window's title bar (data-titlebar, index.css). */}
      <header
        data-titlebar
        data-titlebar-inset
        className={cn(
          '[view-transition-name:app-header] fixed inset-x-0 top-0 z-40 box-content flex h-14 items-center justify-between gap-4 border-b px-4 pt-(--safe-top) transition-colors duration-300 sm:px-8',
          scrolled ? 'border-border bg-background/80 backdrop-blur' : 'border-transparent',
        )}
      >
        {/* Scrim keeps the nav readable over bright hero images until the solid bar takes over. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-linear-to-b from-background/80 to-transparent transition-opacity duration-300',
            scrolled && 'opacity-0',
          )}
        />
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <div className="contents md:hidden">
            <PhoneLead tabs={tabs} />
          </div>
          <div className="hidden md:block">
            <BackButton />
          </div>
          <AppBrand mode="watch" />
          {/* Phones navigate with the tabs at the bottom. */}
          <div className="hidden min-w-0 md:contents">
            <Nav />
          </div>
          <PluginSlot name="header:start" className="flex items-center gap-1" />
        </div>
        <HeaderActions />
      </header>
      {/* Pages start below the system's status bar; on phones they end above the tabs and the player. */}
      <main className="pt-(--safe-top) pb-(--bottom-inset)">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <SettingsEffects />
      {/* Music started in Listen keeps playing here: a small card in the corner, on phones a bar above the tabs. */}
      <MiniPlayer />
      <ListenControlsProvider>
        <PhoneMiniPlayer onOpen={() => openPhonePlayer()} />
        <PhonePlayer />
      </ListenControlsProvider>
      <TabBar tabs={tabs} pathname={pathname} />
    </div>
  )
}

/** The header's right side, shared by both apps: plugin slot, search, watch together, play on, and the profile menu. */
export function HeaderActions({ search = true }: { search?: boolean }) {
  const { session, logout } = useAuthedSession()
  const plugins = usePluginRegistry()
  const hideSearch = useHidden('header:search')
  const hideSyncPlay = useHidden('header:syncplay')
  const hideCast = useHidden('header:cast')
  const t = useMessages(shellMessages)
  const mode = useAppMode()
  const appPromoted = useAppPromoted()
  // "Connect a device" opens at once when asked for by address (jellyfin-web's Quick Connect page leads to /?connect=1).
  const [connectOpen, setConnectOpen] = useState(() => new URLSearchParams(window.location.search).has('connect'))
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <PluginSlot name="header:end" className="flex items-center gap-1" />
        {/* Phones search in their own tab. */}
        {search && !hideSearch && (
          <div className="hidden md:contents">
            <HeaderSearch />
          </div>
        )}
        {/* Offline, and what downloads: only while there is something to tell. */}
        <OfflineBadge />
        <DownloadManagerButton />
        <FriendActivityButton />
        {!hideSyncPlay && <SyncPlayMenu />}
        {!hideCast && <DeviceMenu />}
        <DropdownMenu>
          {/* Phones have the profile menu as a drawer behind the picture at the top left (PhoneLead). */}
          <DropdownMenuTrigger className="ml-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:hidden" aria-label={t.profile}>
            <UserAvatar />
          </DropdownMenuTrigger>
          {/* Own width: by default the menu is as wide as the avatar that opens it, which wraps every entry. */}
          <DropdownMenuContent align="end" className="w-60 [&_[data-slot=dropdown-menu-item]]:whitespace-nowrap">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{session.userName}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Listen has public profiles (playlists, follows); Watch doesn't. */}
            {mode === 'listen' && (
              <DropdownMenuItem render={<Link to={`/listen/user/${session.userId}`} />}>
                <IconUser /> {t.profile}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem render={<Link to={inMode(mode, '/history')} />}>
              <IconHistory /> {t.history}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* One entry for all settings (their pages are listed on the settings page itself). */}
            <DropdownMenuItem render={<Link to={inMode(mode, '/settings')} />}>
              <IconSettings /> {t.settings}
            </DropdownMenuItem>
            <ThemeMenu />
            <AdminMenuItems />
            {plugins.menuItems.length > 0 && <DropdownMenuSeparator />}
            {plugins.menuItems.map((item) =>
              item.href ? (
                <DropdownMenuItem key={item.id} render={<Link to={item.href} />}>
                  {item.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={item.id} onClick={item.onClick}>
                  {item.label}
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConnectOpen(true)}>
              <IconDeviceMobile /> {t.quickConnect}
            </DropdownMenuItem>
            {/* In a browser on a system with an app the admin promotes (never inside one of the apps). */}
            {appPromoted && (
              <DropdownMenuItem render={<a href={APP_DOWNLOAD_URL} target="_blank" rel="noreferrer noopener" />}>
                <IconDownload /> {t.getApp}
                <IconExternalLink className="ml-auto size-3.5 text-muted-foreground" />
              </DropdownMenuItem>
            )}
            {/* Inside Jellyfin's Android app: its own screens, which its own web client reaches the same way. */}
            {inJellyfinApp() && (
              <>
                <DropdownMenuItem onClick={openAppSettings}>
                  <IconAdjustments /> {t.appSettings}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openServerSelection}>
                  <IconServer /> {t.switchServer}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()}>
              <IconLogout /> {t.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConnectDeviceDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  )
}

/** The theme right from the profile menu: like the device, dark or light (also in settings → interface). */
function ThemeMenu() {
  const t = useMessages(shellMessages)
  const [preference, setPreference] = useThemePreference()
  const theme = useTheme()
  const options: Array<{ value: ThemePreference; label: string; icon: typeof IconSun }> = [
    { value: 'system', label: t.themeSystem, icon: IconDeviceDesktop },
    { value: 'dark', label: t.themeDark, icon: IconMoon },
    { value: 'light', label: t.themeLight, icon: IconSun },
  ]
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {theme === 'dark' ? <IconMoon /> : <IconSun />} {t.theme}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        <DropdownMenuRadioGroup value={preference} onValueChange={(value) => setPreference(value as ThemePreference)}>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} closeOnClick>
              <Icon /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
