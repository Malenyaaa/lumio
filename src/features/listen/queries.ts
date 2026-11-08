import { BaseItemKind, ItemFields, ItemFilter, ItemSortBy, SortOrder, type BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQuery } from '@tanstack/react-query'
import { useAuthedSession } from '@/features/auth/session'

const fields = [ItemFields.PrimaryImageAspectRatio]

/**
 * Albums (and audiobooks) the user played most recently, newest first. Jellyfin records plays per track, so this
 * walks the recently played tracks and keeps the first appearance of each album.
 */
export function useRecentAlbums(limit = 12) {
  const { api, session } = useAuthedSession()
  return useQuery({
    queryKey: ['listen-recent-albums', session.userId, limit],
    queryFn: async () => {
      const tracks =
        (
          await getLibraryApi(api).getItems({
            userId: session.userId,
            recursive: true,
            includeItemTypes: [BaseItemKind.Audio],
            filters: [ItemFilter.IsPlayed],
            sortBy: [ItemSortBy.DatePlayed],
            sortOrder: [SortOrder.Descending],
            enableImages: false,
            limit: 200,
          })
        ).data.Items ?? []
      const ids = [...new Set(tracks.map((track) => track.AlbumId).filter((id): id is string => !!id))].slice(0, limit)
      if (!ids.length) return []
      const albums = (await getLibraryApi(api).getItems({ userId: session.userId, ids, fields })).data.Items ?? []
      // The request returns them in its own order; restore "most recent first".
      const byId = new Map(albums.map((album) => [album.Id, album]))
      return ids.map((id) => byId.get(id)).filter((album): album is BaseItemDto => !!album)
    },
  })
}

/** The newest albums of some libraries (e.g. all music libraries), merged and newest first. */
export function useNewestAlbums(views: BaseItemDto[], limit = 20) {
  const { api, session } = useAuthedSession()
  return useQuery({
    queryKey: ['listen-newest', session.userId, views.map((view) => view.Id), limit],
    enabled: views.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(
        views.map(
          async (view) =>
            (
              await getLibraryApi(api).getItems({
                userId: session.userId,
                parentId: view.Id!,
                recursive: true,
                includeItemTypes: [BaseItemKind.MusicAlbum],
                sortBy: [ItemSortBy.DateCreated],
                sortOrder: [SortOrder.Descending],
                fields: [...fields, ItemFields.DateCreated],
                limit,
              })
            ).data.Items ?? [],
        ),
      )
      return lists
        .flat()
        .sort((a, b) => Date.parse(b.DateCreated ?? '') - Date.parse(a.DateCreated ?? ''))
        .slice(0, limit)
    },
  })
}
