import { getPlaylistApi } from '@jellyfin/sdk/lib/utils/api/playlist-api'
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useAuthedSession } from '@/features/auth/session'
import { usePlayCollection } from '@/features/listen/music-card'
import { music, START } from '@/features/listen/player/music-player'
import { podcastOptions } from '@/features/listen/podcasts'
import type { SearchTarget } from './recent-searches'

/** Results that can be played right from the search: music in Listen's player, videos and audiobooks via /play. */
const MUSIC = new Set(['MusicArtist', 'MusicAlbum', 'Audio', 'Playlist'])
const VIA_PLAYER = new Set(['Movie', 'Episode', 'AudioBook', 'Video', 'MusicVideo'])

export const canPlay = (target: SearchTarget) => target.kind === 'podcast' || MUSIC.has(target.type) || VIA_PLAYER.has(target.type)

/** Plays a search result (also a remembered one, of which only the id and type are known). */
export function usePlayResult() {
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const playCollection = usePlayCollection()
  return async (target: SearchTarget) => {
    if (target.kind === 'podcast') {
      // A show plays its newest episode.
      const show = await queryClient.fetchQuery(podcastOptions(target.id))
      const latest = show.episodes[0]
      if (latest) music.play([latest.item], 0, { source: `podcast:${target.id}` })
      return
    }
    if (VIA_PLAYER.has(target.type)) return void navigate(`/play/${target.id}`)
    if (target.type === 'Playlist') {
      const tracks = (await getPlaylistApi(api).getPlaylistItems({ playlistId: target.id, userId: session.userId })).data.Items ?? []
      return music.play(tracks, START, { source: `playlist:${target.id}` })
    }
    if (target.type === 'Audio') {
      const track = (await getLibraryApi(api).getItem({ itemId: target.id, userId: session.userId })).data
      return music.play([track])
    }
    return playCollection({ Id: target.id, Type: target.type as 'MusicAlbum' })
  }
}
