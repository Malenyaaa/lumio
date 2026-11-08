import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { FriendActivityButton } from '@/features/social/social-ui'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api'
import { IconArrowLeft, IconDeviceMobile, IconExternalLink, IconHistory, IconLayoutDashboard, IconLogout, IconSettings, IconTags, IconUser } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { AppBrand } from '@/components/app-switcher'
import { Link } from '@/components/link'
import { shellMessages } from '@/components/messages'
import { PageTransition } from '@/components/page-transition'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { HeaderSearch } from '@/features/search/header-search'
import { useLocalSettings } from '@/features/settings/local-settings'
import { useSettingsPages } from '@/features/settings/settings-pages'
import { useUserConfiguration } from '@/features/settings/use-user-configuration'
import { useMessages } from '@/lib/i18n'
import { markAppReady } from '@/lib/boot'
import { inMode, isLaunchAtRoot, lastMode, modeHome, rememberMode, rememberPath, useAppMode } from '@/lib/app-mode'
import { nameColor } from '@/lib/name-color'
import { cn } from '@/lib/utils'

/**
 * One step back in the app's own history, like the browser's back button. Only shown where there is somewhere in the
 * app to go back to (not on the home screen, not on a page opened directly from outside).
 */
export function BackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const mode = useAppMode()
  const t = useMessages(shellMessages)
  // React Router numbers its history entries; 0 is the first page of this visit.
  const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const visible = pathname !== modeHome(mode) && index > 0
  // The slot is always there (empty when there is nowhere to go), so the logo and navigation never shift.
  return (
    <div className="-ml-2 size-9 shrink-0">
      {visible && (
        <Button variant="ghost" size="icon" aria-label={t.back} title={t.back} className="animate-in fade-in-0 duration-200" onClick={() => void navigate(-1)}>
          <IconArrowLeft />
        </Button>
      )}
    </div>
  )
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

/** Jellyfin's own admin pages; Lumio has no admin UI, so these open the stock web client in a new tab. */
const ADMIN_PAGES = [
  { path: '/dashboard', labelKey: 'dashboard', icon: IconLayoutDashboard },
  { path: '/metadata', labelKey: 'metadata', icon: IconTags },
] as const

/** Menu entries for administrators only. */
function AdminMenuItems({ pages }: { pages: ReturnType<typeof useSettingsPages> }) {
  const { session } = useAuthedSession()
  const user = useUserConfiguration()
  const t = useMessages(shellMessages)
  if (!user.data?.Policy?.IsAdministrator) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.administration}</DropdownMenuLabel>
      </DropdownMenuGroup>
      {/* Lumio's own server-wide settings, then Jellyfin's dashboard pages. */}
      {pages.map(({ to, label, icon: Icon }) => (
        <DropdownMenuItem key={to} render={<Link to={to} />}>
          <Icon /> {label}
        </DropdownMenuItem>
      ))}
      {ADMIN_PAGES.map(({ path, labelKey, icon: Icon }) => (
        <DropdownMenuItem key={path} render={<a href={`${session.serverUrl}/web/#${path}`} target="_blank" rel="noreferrer noopener" />}>
          <Icon /> {t[labelKey]}
          <IconExternalLink className="ml-auto size-3.5 text-muted-foreground" />
        </DropdownMenuItem>
      ))}
    </>
  )
}


/** The user's profile picture, or their initials on a color generated from their name. */
function UserAvatar() {
  const { api, session } = useAuthedSession()
  const user = useUserConfiguration()
  const image = user.data?.PrimaryImageTag ? getImageApi(api).getUserImageUrl(user.data, { width: 96 }) : undefined
  return (
    <Avatar className="size-8">
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback className="font-medium text-white" style={{ background: nameColor(session.userName) }}>
        {session.userName.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
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

function SignedInShell() {
  const { session } = useSession()
  const [scrolled, setScrolled] = useState(false)

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
    <div data-app-shell className="min-h-svh">
      <header
        className={cn(
          '[view-transition-name:app-header] fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-4 border-b px-4 transition-colors duration-300 sm:px-8',
          scrolled ? 'border-border bg-background/80 backdrop-blur' : 'border-transparent',
        )}
      >
        {/* Scrim keeps the nav readable over bright hero images until the solid bar takes over. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-linear-to-b from-black/70 to-transparent transition-opacity duration-300',
            scrolled && 'opacity-0',
          )}
        />
        <div className="flex min-w-0 items-center gap-4">
          <BackButton />
          <AppBrand mode="watch" />
          <Nav />
          <PluginSlot name="header:start" className="flex items-center gap-1" />
        </div>
        <HeaderActions />
      </header>
      <main>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <SettingsEffects />
      {/* Music started in Listen keeps playing here, in a small card. */}
      <MiniPlayer />
    </div>
  )
}

/** The header's right side, shared by both apps: plugin slot, search, watch together, play on, and the profile menu. */
export function HeaderActions({ search = true }: { search?: boolean }) {
  const { session, logout } = useAuthedSession()
  const settingsPages = useSettingsPages()
  const plugins = usePluginRegistry()
  const hideSearch = useHidden('header:search')
  const hideSyncPlay = useHidden('header:syncplay')
  const hideCast = useHidden('header:cast')
  const t = useMessages(shellMessages)
  const mode = useAppMode()
  const [connectOpen, setConnectOpen] = useState(false)
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <PluginSlot name="header:end" className="flex items-center gap-1" />
        {search && !hideSearch && <HeaderSearch />}
        <FriendActivityButton />
        {!hideSyncPlay && <SyncPlayMenu />}
        {!hideCast && <DeviceMenu />}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t.profile}>
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
            <AdminMenuItems pages={settingsPages.filter((page) => page.admin)} />
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
