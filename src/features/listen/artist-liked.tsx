import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconHeartFilled, IconMicrophone2 } from '@tabler/icons-react'
import { useParams } from 'react-router'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { useAuthedSession } from '@/features/auth/session'
import { useItem } from '@/features/items/queries'
import { useDominantColor } from '@/lib/dominant-color'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useArtistPhoto } from './artist-photo'
import { Collection } from './collection-pages'
import { MusicRow } from './music-card'
import { useLikedSongs, useSavedAlbums } from './playlists'

const messages = defineMessages({
  de: {
    youLike: 'Dir gefällt Folgendes',
    count: (songs: number, releases: number) =>
      [songs ? (songs === 1 ? '1 Song' : `${songs} Songs`) : '', releases ? (releases === 1 ? '1 Release' : `${releases} Releases`) : ''].filter(Boolean).join(' • '),
    by: (name: string) => `Von ${name}`,
    kind: 'Favoriten',
    title: (name: string) => `Songs von ${name}, die dir gefallen`,
    releases: 'Gespeicherte Releases',
    empty: 'Du hast noch keine Songs dieses Künstlers mit dem Herz markiert.',
  },
  en: {
    youLike: 'You liked',
    count: (songs: number, releases: number) =>
      [songs ? (songs === 1 ? '1 song' : `${songs} songs`) : '', releases ? (releases === 1 ? '1 release' : `${releases} releases`) : ''].filter(Boolean).join(' • '),
    by: (name: string) => `By ${name}`,
    kind: 'Favorites',
    title: (name: string) => `Liked songs by ${name}`,
    releases: 'Saved releases',
    empty: "You haven't liked any songs by this artist yet.",
  },
})

const byArtist = (item: BaseItemDto, artistId: string) =>
  !!item.ArtistItems?.some((artist) => artist.Id === artistId) || !!item.AlbumArtists?.some((artist) => artist.Id === artistId)

/** The songs the user liked and the releases they saved, by one artist. */
function useLikedByArtist(artistId: string) {
  const liked = useLikedSongs()
  const saved = useSavedAlbums()
  return {
    songs: (liked.data ?? []).filter((track) => byArtist(track, artistId)),
    releases: (saved.data ?? []).filter((album) => byArtist(album, artistId)),
    loading: liked.isLoading,
  }
}

/** The artist's photo with a heart on it, as Spotify marks what you liked by an artist. */
function LikedArtistCover({ artist, className, badge }: { artist?: BaseItemDto; className?: string; badge: string }) {
  const photo = useArtistPhoto(artist, 480)
  return (
    <div className={cn('relative shrink-0', className)}>
      <div className="size-full overflow-hidden rounded-full bg-muted">
        {photo ? (
          <FadeImage src={photo} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <IconMicrophone2 className="size-1/3" stroke={1.25} />
          </div>
        )}
      </div>
      <span className={cn('absolute bottom-0 right-0 grid place-items-center rounded-full border-background bg-primary text-primary-foreground', badge)}>
        <IconHeartFilled className="size-1/2" />
      </span>
    </div>
  )
}

/** "You liked": beside the artist's popular songs, how many of their songs and releases the user liked; opens them. */
export function LikedFromArtist({ artist }: { artist: BaseItemDto }) {
  const t = useMessages(messages)
  const { songs, releases } = useLikedByArtist(artist.Id!)
  if (!songs.length && !releases.length) return null
  return (
    <section className="w-full shrink-0 xl:w-80">
      <h2 className="mb-3 text-2xl font-extrabold tracking-tight">{t.youLike}</h2>
      <Link to={`/listen/artist/${artist.Id}/liked`} className="flex items-center gap-4 rounded-md p-2 transition-colors hover:bg-foreground/[0.07]">
        <LikedArtistCover artist={artist} className="size-20" badge="size-7 border-2" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{t.count(songs.length, releases.length)}</p>
          <p className="truncate text-sm text-muted-foreground">{t.by(artist.Name ?? '')}</p>
        </div>
      </Link>
    </section>
  )
}

/** The songs by an artist the user liked, as a playlist, and the artist's releases they saved. */
export function ArtistLikedPage() {
  const { id = '' } = useParams()
  const t = useMessages(messages)
  const { session } = useAuthedSession()
  const artist = useItem(id).data
  const { songs, releases, loading } = useLikedByArtist(id)
  const photo = useArtistPhoto(artist, 64)
  const tint = useDominantColor(photo).data
  return (
    <>
      <Collection
        kind={t.kind}
        title={t.title(artist?.Name ?? '')}
        cover={<LikedArtistCover artist={artist} className="size-full p-6" badge="bottom-6 right-6 size-14 border-4" />}
        byline={<span className="font-bold text-foreground">{session.userName}</span>}
        tracks={songs}
        loading={loading}
        source={`artist-liked:${id}`}
        tint={tint ?? undefined}
        empty={t.empty}
      />
      <div className="pb-12">
        <MusicRow title={t.releases} items={releases} />
      </div>
    </>
  )
}
