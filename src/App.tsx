import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider, ScrollRestoration } from 'react-router'
import { ErrorBoundary, RouteError } from '@/components/error-boundary'
import { NotFound } from '@/components/not-found'
import { AppShell, RequireSession } from '@/components/app-shell'
import { Toaster } from '@/components/ui/sonner'
import { useToastsWanted } from '@/features/settings/local-settings'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@/features/auth/login-page'
import { SessionProvider, useSession } from '@/features/auth/session'
import { SocialHost } from '@/features/social/social-host'
import { HomePage } from '@/features/home/home-page'
import { LikedSongsPage, OfficialPlaylistPage, PlaylistPage } from '@/features/listen/collection-pages'
import { ConcertPage, ConcertsPage } from '@/features/listen/concert-pages'
import { ArtistDiscographyPage } from '@/features/listen/artist-discography'
import { ArtistLikedPage } from '@/features/listen/artist-liked'
import { GuestArtistPage } from '@/features/listen/guest-artist-page'
import { ListenHome } from '@/features/listen/listen-home'
import { PlatformPage } from '@/features/listen/platform-page'
import { EpisodePage, PodcastPage, PodcastsPage, SavedEpisodesPage } from '@/features/listen/podcast-pages'
import { ProfilePage as ListenProfilePage } from '@/features/listen/profile-page'
import { ListenShell } from '@/features/listen/listen-shell'
import { MusicPlayerHost } from '@/features/listen/player/music-host'
import { PlayEntry } from '@/features/listen/player/play-entry'
import { DetailPage } from '@/features/items/detail-page'
import { CategoryPage } from '@/features/library/category-page'
import { HistoryPage } from '@/features/library/history-page'
import { LibraryPage } from '@/features/library/library-page'
import { PersonPage } from '@/features/library/person-page'
import { WatchlistPage } from '@/features/library/watchlist-page'
import { DisplayPage } from '@/features/admin/display-page'
import { MetadataPage } from '@/features/admin/metadata-page'
import { BrandingEffects } from '@/features/admin/branding'
import { BrandingPage } from '@/features/admin/branding-page'
import { PluginRoutePage } from '@/features/admin/plugin-route-page'
import { PluginsPage } from '@/features/admin/plugins-page'
import { RemoteProvider } from '@/features/remote/remote-provider'
import { SearchPage } from '@/features/search/search-page'
import { ControlsPage } from '@/features/settings/controls-page'
import { HomeSettingsPage } from '@/features/settings/home-settings-page'
import { InterfacePage } from '@/features/settings/interface-page'
import { DownloadsPage, PlaybackPage } from '@/features/settings/playback-page'
import { PrivacyPage } from '@/features/settings/privacy-page'
import { ProfilePage } from '@/features/settings/profile-page'
import { SettingsLayout } from '@/features/settings/settings-layout'
import { SubtitlesPage } from '@/features/settings/subtitles-page'

import { queryClient } from '@/lib/query-client'

// A data router (instead of <BrowserRouter>) is what enables View Transitions between pages.
function RootLayout() {
  return (
    <RemoteProvider>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <BrandingEffects />
      <MusicPlayerHost />
      <SocialHostWhenSignedIn />
      {/* Coming back (from the player, a detail page, the browser's back button) returns to the same scroll position. */}
      <ScrollRestoration />
    </RemoteProvider>
  )
}

/** The Lumio server connection exists only while someone is signed in. */
function SocialHostWhenSignedIn() {
  return useSession().session ? <SocialHost /> : null
}

/** The settings pages; both apps have them (under /settings and /listen/settings), in their own frame. */
function settingsRoutes() {
  return (
    <Route path="settings" element={<SettingsLayout />}>
      <Route index element={<Navigate to="profile" replace />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="home" element={<HomeSettingsPage />} />
      <Route path="playback" element={<PlaybackPage />} />
      <Route path="downloads" element={<DownloadsPage />} />
      <Route path="subtitles" element={<SubtitlesPage />} />
      <Route path="controls" element={<ControlsPage />} />
      <Route path="interface" element={<InterfacePage />} />
      <Route path="privacy" element={<PrivacyPage />} />
      <Route path="display" element={<DisplayPage />} />
      <Route path="branding" element={<BrandingPage />} />
      <Route path="plugins" element={<PluginsPage />} />
      <Route path="metadata" element={<MetadataPage />} />
    </Route>
  )
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />} errorElement={<RouteError />}>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        {/* Films live under /movie, series under /show, everything else under /item. Any of them accepts any id and
            the page corrects the address (like GitHub's /issues and /pull). */}
        <Route path="movie/:id" element={<DetailPage />} />
        <Route path="show/:id" element={<DetailPage />} />
        <Route path="album/:id" element={<DetailPage />} />
        <Route path="artist/:id" element={<DetailPage />} />
        <Route path="item/:id" element={<DetailPage />} />
        <Route path="browse/:category" element={<CategoryPage />} />
        <Route path="library/:id" element={<LibraryPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="person/:id" element={<PersonPage />} />
        {settingsRoutes()}
        <Route path="plugin/*" element={<PluginRoutePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Listen: music, audiobooks and podcasts, in a frame of its own. */}
      <Route path="listen" element={<ListenShell />}>
        <Route index element={<ListenHome />} />
        <Route path="album/:id" element={<DetailPage />} />
        <Route path="artist/:id" element={<DetailPage />} />
        <Route path="artist/:id/discography" element={<ArtistDiscographyPage />} />
        <Route path="artist/:id/liked" element={<ArtistLikedPage />} />
        <Route path="guest/:name" element={<GuestArtistPage />} />
        <Route path="browse/:category" element={<CategoryPage />} />
        <Route path="playlist/:id" element={<PlaylistPage />} />
        <Route path="official/:slug" element={<OfficialPlaylistPage />} />
        <Route path="liked" element={<LikedSongsPage />} />
        <Route path="user/:id" element={<ListenProfilePage />} />
        <Route path="platform" element={<PlatformPage />} />
        <Route path="podcasts" element={<PodcastsPage />} />
        <Route path="podcast/:id" element={<PodcastPage />} />
        <Route path="podcast/:id/episode/:episodeId" element={<EpisodePage />} />
        <Route path="episodes" element={<SavedEpisodesPage />} />
        <Route path="concerts" element={<ConcertsPage />} />
        <Route path="concert/:id" element={<ConcertPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="history" element={<HistoryPage />} />
        {settingsRoutes()}
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<RequireSession />}>
        <Route
          path="play/:id"
          element={<PlayEntry />}
        />
      </Route>
    </Route>,
  ),
)

/** The notices, unless the user turned them off (Settings → Interface). */
function WantedToaster() {
  return useToastsWanted() ? <Toaster /> : null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <WantedToaster />
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
