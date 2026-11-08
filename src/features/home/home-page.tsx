import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQueries } from '@tanstack/react-query'
import { useEffect } from 'react'
import { MediaRow } from '@/components/media/media-row'
import type { CardShape } from '@/components/media/media-card'
import { applyTransforms, PluginSlot, usePluginRegistry } from '@/features/admin/plugins'
import { useAuthedSession } from '@/features/auth/session'
import { useFavorites } from '@/features/items/queries'
import { CATEGORY_MODE, categoryOf, orderViews } from '@/features/library/categories'
import { useLocalSettings } from '@/features/settings/local-settings'
import { useUserConfiguration } from '@/features/settings/use-user-configuration'
import { markAppReady } from '@/lib/boot'
import { useMessages } from '@/lib/i18n'
import { Hero } from './hero'
import { homeMessages } from './messages'
import { usePersonalHome } from './personal-rows'
import { useNextUp, useResumeItems, useUserViews } from './queries'

/**
 * One row of the home screen. Plugins see and may change the list as `transform('homeRows', rows => rows)`; hiding one
 * works with `hide('home:<id>')`.
 */
export interface HomeRow {
  id: string
  title: string
  items?: BaseItemDto[]
  loading?: boolean
  shape?: CardShape
}

const SUPPORTED_VIEWS = new Set(['movies', 'tvshows', 'music', 'boxsets', 'homevideos'])

export function HomePage() {
  const { settings } = useLocalSettings()
  return settings.homeLayout === 'jellyfin' ? <JellyfinHome /> : <PersonalHome />
}

/** Rows built from the user's own history (see personal-rows.ts). */
function PersonalHome() {
  const t = useMessages(homeMessages)
  const home = usePersonalHome()
  const watchlist = useFavorites(20)

  const rows: HomeRow[] = []
  for (const row of home.rows) {
    if (row.kind === 'continue') {
      rows.push({ id: row.id, title: t.continue, items: row.items, loading: row.loading, shape: 'landscape' })
      // The user's own picks right after what they are in the middle of.
      rows.push({ id: 'watchlist', title: t.myWatchlist, items: watchlist.data })
    } else if (row.kind === 'because') {
      rows.push({ id: row.id, title: t.becauseYouWatched(row.source.Name ?? ''), items: row.items, loading: row.loading })
    } else if (row.kind === 'genre') {
      rows.push({ id: row.id, title: t.genreForYou(row.genre), items: row.items, loading: row.loading })
    } else if (row.kind === 'discover') {
      rows.push({ id: row.id, title: t.discoverGenre(row.genre), items: row.items, loading: row.loading })
    } else {
      rows.push({ id: row.id, title: t.newlyAdded, items: row.items, loading: row.loading })
    }
  }

  return <HomeLayout rows={rows} featured={home.featured} featuredLoading={home.loading} />
}

/** Jellyfin's classic home: continue watching, up next, and the latest additions of each library. */
function isListenView(view: BaseItemDto) {
  const category = categoryOf(view)
  return !!category && CATEGORY_MODE[category] === 'listen'
}

function JellyfinHome() {
  const { api, session } = useAuthedSession()
  const t = useMessages(homeMessages)
  const resume = useResumeItems()
  const nextUp = useNextUp()
  const views = useUserViews()
  const user = useUserConfiguration()
  const watchlist = useFavorites(20)

  const config = user.data?.Configuration
  const excluded = new Set(config?.LatestItemsExcludes ?? [])
  const libraries = orderViews(views.data ?? [], config?.OrderedViews).filter(
    (view) =>
      SUPPORTED_VIEWS.has(view.CollectionType ?? '') &&
      !excluded.has(view.Id!) &&
      !(config?.MyMediaExcludes ?? []).includes(view.Id!) &&
      // Music and audiobooks have their own app (Listen).
      !isListenView(view),
  )
  const latest = useQueries({
    queries: libraries.map((view) => ({
      queryKey: ['latest', session.userId, view.Id],
      queryFn: async () => (await getLibraryApi(api).getLatestMedia({ userId: session.userId, parentId: view.Id!, limit: 20 })).data,
    })),
  })

  const rows: HomeRow[] = [
    { id: 'continue-watching', title: t.continueWatching, items: resume.data, loading: resume.isLoading, shape: 'landscape' },
    { id: 'watchlist', title: t.myWatchlist, items: watchlist.data },
    { id: 'up-next', title: t.upNext, items: nextUp.data, loading: nextUp.isLoading, shape: 'landscape' },
    ...libraries.map((view, index) => ({
      id: `latest-${view.Id}`,
      title: t.latestIn(view.Name ?? ''),
      items: latest[index]?.data,
      loading: latest[index]?.isLoading,
    })),
  ]

  const featured = [...(resume.data ?? []), ...(nextUp.data ?? [])]
  return <HomeLayout rows={rows} featured={featured} featuredLoading={featured.length === 0 && (resume.isLoading || nextUp.isLoading)} />
}

function HomeLayout({ rows, featured, featuredLoading }: { rows: HomeRow[]; featured: BaseItemDto[]; featuredLoading: boolean }) {
  // The boot screen lifts once the hero has what it shows first.
  useEffect(() => {
    if (!featuredLoading) markAppReady()
  }, [featuredLoading])
  const { hidden } = usePluginRegistry()
  const shown = applyTransforms('homeRows', rows).filter((row) => !hidden.includes(`home:${row.id}`))
  return (
    <div>
      {!hidden.includes('home:hero') && <Hero items={featured} loading={featuredLoading} />}
      <div className="relative -mt-16 space-y-10 pb-10">
        <PluginSlot name="home:top" className="px-4 sm:px-8" />
        {shown.map((row) => (
          <MediaRow key={row.id} title={row.title} items={row.items} loading={row.loading} shape={row.shape} />
        ))}
        <PluginSlot name="home:bottom" className="px-4 sm:px-8" />
      </div>
    </div>
  )
}
