import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { usePluginRegistry } from '@/features/admin/plugins'
import { useUserViews } from '@/features/home/queries'
import { useUserConfiguration } from '@/features/settings/use-user-configuration'
import { inMode, type AppMode } from '@/lib/app-mode'
import { defineMessages, useMessages } from '@/lib/i18n'

/**
 * The top navigation groups libraries by what they hold rather than listing each one: all movie libraries under
 * "Filme", all series under "Serien", and so on. Anime gets its own entry; Jellyfin has no such library type, so a
 * series library counts as anime by its name. Libraries of any other type keep an entry of their own.
 */
export type CategoryId = 'movies' | 'shows' | 'anime' | 'music' | 'audiobooks' | 'books' | 'videos'

/** Fixed order in the navigation. */
const ORDER: CategoryId[] = ['movies', 'shows', 'anime', 'music', 'audiobooks', 'books', 'videos']

/** Which app a category belongs to: what you listen to goes to Listen, the rest stays in Watch. */
export const CATEGORY_MODE: Record<CategoryId, AppMode> = {
  movies: 'watch',
  shows: 'watch',
  anime: 'watch',
  videos: 'watch',
  books: 'watch',
  music: 'listen',
  audiobooks: 'listen',
}

/** Where a category's page lives. */
export const categoryPath = (id: CategoryId) => inMode(CATEGORY_MODE[id], `/browse/${id}`)

export const categoryMessages = defineMessages({
  de: { movies: 'Filme', shows: 'Serien', anime: 'Anime', music: 'Musik', audiobooks: 'Hörbücher', books: 'Bücher', videos: 'Videos' },
  en: { movies: 'Movies', shows: 'Shows', anime: 'Anime', music: 'Music', audiobooks: 'Audiobooks', books: 'Books', videos: 'Videos' },
})

const ANIME = /anime/i
const AUDIOBOOKS = /h[öo]rb[üu]ch|h[öo]rspiel|audio\s*-?\s*(books?|b[üu]ch)/i

export function categoryOf(view: BaseItemDto): CategoryId | undefined {
  const name = view.Name ?? ''
  switch (view.CollectionType) {
    case 'movies':
      return 'movies'
    case 'tvshows':
      return ANIME.test(name) ? 'anime' : 'shows'
    case 'music':
      // Audiobooks are often set up as music libraries (chapters as tracks); the name tells them apart.
      return AUDIOBOOKS.test(name) ? 'audiobooks' : 'music'
    case 'books':
      return AUDIOBOOKS.test(name) ? 'audiobooks' : 'books'
    case 'homevideos':
    case 'musicvideos':
      return 'videos'
    default:
      return undefined
  }
}

export interface Category {
  id: CategoryId
  label: string
  /** Its libraries, in the user's order (settings → Home). */
  views: BaseItemDto[]
}

/**
 * The navigation's categories plus the libraries that fit none of them. Libraries the user hid (settings → Home) or a
 * plugin removed (`nav:<library id>`) are left out; a plugin can hide a whole category with `nav:<category>`.
 */
export function useCategories(mode?: AppMode) {
  const views = useUserViews()
  const user = useUserConfiguration()
  const { hidden } = usePluginRegistry()
  const names = useMessages(categoryMessages)

  const config = user.data?.Configuration
  const excluded = new Set(config?.MyMediaExcludes ?? [])
  const visible = orderViews(views.data ?? [], config?.OrderedViews).filter((view) => !excluded.has(view.Id!) && !hidden.includes(`nav:${view.Id}`))

  const categories: Category[] = ORDER.filter((id) => !hidden.includes(`nav:${id}`) && (!mode || CATEGORY_MODE[id] === mode))
    .map((id) => ({ id, label: names[id], views: visible.filter((view) => categoryOf(view) === id) }))
    .filter((category) => category.views.length > 0)
  // Libraries of other kinds keep their own entry in Watch.
  const others = mode === 'listen' ? [] : visible.filter((view) => !categoryOf(view))

  return { categories, others, all: views.data ?? [], isLoading: views.isLoading || user.isLoading }
}

/** The libraries in the user's order: the saved order first, libraries not in it (new ones) after. */
export function orderViews(views: BaseItemDto[], order: string[] | null | undefined) {
  const position = new Map((order ?? []).map((id, index) => [id, index]))
  return [...views].sort((a, b) => (position.get(a.Id ?? '') ?? Infinity) - (position.get(b.Id ?? '') ?? Infinity))
}

export const isCategoryId = (value: string | undefined): value is CategoryId => ORDER.includes(value as CategoryId)
