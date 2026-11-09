import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api'
import { IconCopy, IconDots, IconPencil, IconSettings } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Link } from '@/components/link'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthedSession } from '@/features/auth/session'
import { useUserConfiguration } from '@/features/settings/use-user-configuration'
import { useDominantColor } from '@/lib/dominant-color'
import { defineMessages, useMessages } from '@/lib/i18n'
import { nameColor } from '@/lib/name-color'
import { cn } from '@/lib/utils'
import { CardRow, MusicCard } from './music-card'
import { PlaylistCard } from './playlist-cards'
import { useFollowedArtists } from './playlists'
import { useSocialFollow, useSocialMe, useSocialProfile, type SocialPerson } from '@/features/social/social'
import { ActivityLine } from '@/features/social/social-ui'
import { useListeningStats, useProfile, useProfilePlaylists } from './profiles'

const messages = defineMessages({
  de: {
    profile: 'Profil',
    publicPlaylists: (n: number) => (n === 1 ? '1 öffentliche Playlist' : `${n} öffentliche Playlists`),
    followingCount: (n: number) => `${n} gefolgt`,
    followerCount: (n: number) => (n === 1 ? '1 Follower*in' : `${n} Follower*innen`),
    followersRow: 'Follower*innen',
    showAll: 'Alle anzeigen',
    all: 'Alle',
    artistsFilter: 'Künstler*innen',
    profilesFilter: 'Profile',
    nobodyFollowed: 'Noch niemandem gefolgt.',
    noFollowers: 'Noch keine Follower*innen.',
    hidden: 'Diese Liste ist privat.',
    friend: 'Freund*in',
    followsYou: 'Folgt dir',
    listening: 'Hört gerade',
    lastActivity: 'Zuletzt',
    noActivity: 'Keine neue Aktivität',
    follow: 'Folgen',
    followed: 'Gefolgt',
    playlists: 'Öffentliche Playlists',
    ownPlaylists: 'Playlists',
    topArtists: 'Top-Künstler*innen diesen Monat',
    recentArtists: 'Kürzlich gehörte Künstler*innen',
    onlyYou: 'Nur für dich sichtbar',
    followingRow: 'Gefolgt',
    editProfile: 'Profil bearbeiten',
    copyLink: 'Link zum Profil kopieren',
    linkCopied: 'Link kopiert: Wer ihn öffnet, kann dir folgen.',
    linkCopiedOther: 'Link kopiert',
    settings: 'Einstellungen',
    more: 'Weitere Optionen',
    unknown: 'Nutzer',
    noPlaylists: 'Noch keine öffentlichen Playlists.',
    details: 'Profil-Details',
    choosePhoto: 'Foto auswählen',
    removePhoto: 'Foto entfernen',
    save: 'Speichern',
    nameHint: 'Der Name ist dein Jellyfin-Benutzername, mit dem du dich anmeldest; ändern kann ihn ein Admin.',
    photoHint: 'Dein Bild sehen alle auf diesem Server, die dein Profil öffnen.',
    photoUpdated: 'Profilbild aktualisiert',
    photoRemoved: 'Profilbild entfernt',
    photoFailed: 'Das Bild konnte nicht gespeichert werden',
    notAnImage: 'Das ist kein Bild.',
  },
  en: {
    profile: 'Profile',
    publicPlaylists: (n: number) => (n === 1 ? '1 public playlist' : `${n} public playlists`),
    followingCount: (n: number) => `${n} following`,
    followerCount: (n: number) => (n === 1 ? '1 follower' : `${n} followers`),
    followersRow: 'Followers',
    showAll: 'Show all',
    all: 'All',
    artistsFilter: 'Artists',
    profilesFilter: 'Profiles',
    nobodyFollowed: 'Not following anyone yet.',
    noFollowers: 'No followers yet.',
    hidden: 'This list is private.',
    friend: 'Friend',
    followsYou: 'Follows you',
    listening: 'Listening now',
    lastActivity: 'Last',
    noActivity: 'No recent activity',
    follow: 'Follow',
    followed: 'Following',
    playlists: 'Public playlists',
    ownPlaylists: 'Playlists',
    topArtists: 'Top artists this month',
    recentArtists: 'Recently played artists',
    onlyYou: 'Only visible to you',
    followingRow: 'Following',
    editProfile: 'Edit profile',
    copyLink: 'Copy link to profile',
    linkCopied: 'Link copied: whoever opens it can follow you.',
    linkCopiedOther: 'Link copied',
    settings: 'Settings',
    more: 'More options',
    unknown: 'User',
    noPlaylists: 'No public playlists yet.',
    details: 'Profile details',
    choosePhoto: 'Choose photo',
    removePhoto: 'Remove photo',
    save: 'Save',
    nameHint: 'The name is your Jellyfin user name, which you sign in with; an admin can change it.',
    photoHint: 'Everyone on this server who opens your profile sees your picture.',
    photoUpdated: 'Profile picture updated',
    photoRemoved: 'Profile picture removed',
    photoFailed: "The picture couldn't be saved",
    notAnImage: "That's not an image.",
  },
})

/** A user's picture URL; the tag (when known) makes a new picture show at once instead of the cached old one. */
const pictureUrl = (basePath: string, userId: string, size: number, tag?: string | null) =>
  `${basePath}/Users/${userId}/Images/Primary?fillHeight=${size}&quality=90${tag ? `&tag=${tag}` : ''}`

/** A user's picture, or their initials on their colour. */
export function ProfileAvatar({ userId, name, tag, className }: { userId: string; name?: string | null; tag?: string | null; className?: string }) {
  const { api } = useAuthedSession()
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const url = pictureUrl(api.basePath, userId, 480, tag)
  const failed = failedFor === url
  return (
    <span
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-bold text-white', className)}
      style={failed ? { background: nameColor(name ?? userId) } : undefined}
    >
      {failed ? (
        <span className="leading-none">{(name ?? '?').slice(0, 2).toUpperCase()}</span>
      ) : (
        <img src={url} alt="" draggable={false} onError={() => setFailedFor(url)} className="size-full object-cover" />
      )}
    </span>
  )
}

/** Copies a profile's address; opening it is how people find each other (there is no list of everyone). */
async function copyProfileLink(userId: string, done: string) {
  try {
    await navigator.clipboard.writeText(new URL(`/listen/user/${userId}`, window.location.origin).toString())
    toast.success(done)
  } catch {
    // No clipboard here (insecure context or denied).
  }
}

/**
 * A person's profile in Listen, as Spotify's: the header on the colour of their picture (name, public playlists, how
 * many they follow), then their public playlists and who they follow. The user's own profile adds their picture to
 * change (click it), settings and the "…" menu, and what only they see: their top artists this month and the artists
 * they played lately.
 */
export function ProfilePage() {
  const { id = '' } = useParams()
  const t = useMessages(messages)
  const { api, session } = useAuthedSession()
  const userId = id === 'me' ? session.userId : id
  const own = userId === session.userId
  const profile = useProfile(userId)
  const me = useUserConfiguration()
  const tag = own ? me.data?.PrimaryImageTag : profile.data?.PrimaryImageTag
  const { playlists, isLoading } = useProfilePlaylists(userId)
  const artists = useFollowedArtists()
  const stats = useListeningStats()
  const [editing, setEditing] = useState(false)
  // Follows live on the Lumio server, which also gives others' lists and counts (as far as they allow).
  const socialMe = useSocialMe()
  const socialOther = useSocialProfile(own ? undefined : userId)
  const social = own ? socialMe.data : socialOther.data
  const followMutation = useSocialFollow()
  const following = !!social?.youFollow
  const toggleFollow = () => followMutation.mutate({ userId, follow: !following })
  const followedIds = (socialMe.data?.following ?? []).map((person) => person.id)
  const followedPeople: SocialPerson[] | null = own ? (socialMe.data?.following ?? null) : (social?.following ?? null)
  const showPlaylists = own || social?.privacy.showPlaylists !== false
  const name = profile.data?.Name ?? (socialOther.data?.person.name || (profile.isLoading ? '' : t.unknown))
  const tint = useDominantColor(pictureUrl(api.basePath, userId, 64, tag)).data

  if (id === 'me') return <Navigate to={`/listen/user/${session.userId}`} replace />
  const publicPlaylists = playlists.filter((info) => info.isPublic)
  const shownPlaylists = own ? playlists : showPlaylists ? publicPlaylists : []
  const background = tint ?? nameColor(name || userId)

  return (
    <div className="pb-12">
      <div className="pt-14" style={{ background: `linear-gradient(to bottom, ${background}, color-mix(in srgb, ${background} 35%, var(--background)))` }}>
        <div className="flex flex-col gap-6 px-4 pb-6 pt-10 sm:flex-row sm:items-end sm:px-8">
          {own ? (
            <button type="button" onClick={() => setEditing(true)} aria-label={t.editProfile} className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ProfileAvatar userId={userId} name={name} tag={tag} className="size-48 text-6xl shadow-2xl shadow-black/50 sm:size-56" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-full bg-black/55 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                <IconPencil className="size-10" stroke={1.5} />
                {t.choosePhoto}
              </span>
            </button>
          ) : (
            <ProfileAvatar userId={userId} name={name} tag={tag} className="size-48 text-6xl shadow-2xl shadow-black/50 sm:size-56" />
          )}
          <div className="min-w-0 space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              {t.profile}
              {social?.friend && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{t.friend}</span>}
              {!social?.friend && social?.followsYou && !own && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{t.followsYou}</span>}
            </p>
            {profile.isLoading ? <Skeleton className="h-16 w-72" /> : <h1 className="text-5xl font-black leading-none tracking-tight text-balance sm:text-7xl xl:text-8xl">{name}</h1>}
            <p className="text-sm text-foreground/85">
              {/* The counts open the lists (where the person shares them). */}
              {[
                showPlaylists ? <span key="playlists">{t.publicPlaylists(publicPlaylists.length)}</span> : null,
                social ? (
                  social.followers ? (
                    <Link key="followers" to={`/listen/user/${userId}/followers`} className="hover:underline">
                      {t.followerCount(social.followerCount)}
                    </Link>
                  ) : (
                    <span key="followers">{t.followerCount(social.followerCount)}</span>
                  )
                ) : null,
                own || social ? (
                  own || social?.following ? (
                    <Link key="following" to={`/listen/user/${userId}/following`} className="hover:underline">
                      {t.followingCount(own ? followedIds.length + (artists.data?.length ?? 0) : (social?.followingCount ?? 0))}
                    </Link>
                  ) : (
                    <span key="following">{t.followingCount(social?.followingCount ?? 0)}</span>
                  )
                ) : null,
              ]
                .filter(Boolean)
                .flatMap((node, index) => (index ? [<span key={`dot-${index}`}> • </span>, node] : [node]))}
            </p>
          </div>
        </div>
      </div>

      <div style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${background} 35%, var(--background)), transparent 14rem)` }}>
        <div className="flex items-center gap-3 px-4 py-5 sm:px-8">
          {!own && (
            <button
              type="button"
              aria-pressed={following}
              disabled={followMutation.isPending}
              onClick={toggleFollow}
              className="h-8 rounded-full border border-foreground/40 px-4 text-sm font-bold transition-colors hover:border-foreground"
            >
              {following ? t.followed : t.follow}
            </button>
          )}
          {own && (
            <Link to="/listen/settings" aria-label={t.settings} title={t.settings} className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
              <IconSettings className="size-6" />
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t.more} className="grid size-9 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <IconDots className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {own && (
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <IconPencil /> {t.editProfile}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => void copyProfileLink(userId, own ? t.linkCopied : t.linkCopiedOther)}>
                <IconCopy /> {t.copyLink}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 space-y-10">
          {/* Friends see each other's activity (when shared): what plays now, or what played last. */}
          {!own && social?.friend && (
            <section className="px-4 sm:px-8">
              {social.activity ? (
                <div className="max-w-xl rounded-xl bg-foreground/[0.06] p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{social.activity.playing ? t.listening : t.lastActivity}</p>
                  <ActivityLine activity={social.activity} />
                </div>
              ) : (
                <p className="py-6 text-center text-xl font-bold">{t.noActivity}</p>
              )}
            </section>
          )}
          {own && (
            <ArtistRow title={t.topArtists} subtitle={t.onlyYou} items={stats.data?.topArtists} loading={stats.isLoading} />
          )}
          <CardRow title={own ? t.ownPlaylists : t.playlists} loading={isLoading}>
            {shownPlaylists.map((info) => (
              <PlaylistCard key={info.playlist.Id} playlist={info.playlist} />
            ))}
          </CardRow>
          {!isLoading && shownPlaylists.length === 0 && <p className="-mt-8 px-4 text-sm text-muted-foreground sm:px-8">{t.noPlaylists}</p>}
          {own && <ArtistRow title={t.recentArtists} subtitle={t.onlyYou} items={stats.data?.recentArtists} loading={stats.isLoading} />}
          {!!social?.followers?.length && (
            <CardRow
              title={t.followersRow}
              action={
                <Link to={`/listen/user/${userId}/followers`} className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline">
                  {t.showAll}
                </Link>
              }
            >
              {social.followers.map((person) => (
                <ProfileCard key={person.id} userId={person.id} name={person.name || undefined} imageTag={person.imageTag} />
              ))}
            </CardRow>
          )}
          {(!!followedPeople?.length || (own && !!artists.data?.length)) && (
            <CardRow
              title={t.followingRow}
              action={
                <Link to={`/listen/user/${userId}/following`} className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline">
                  {t.showAll}
                </Link>
              }
            >
              {followedPeople?.map((person) => (
                <ProfileCard key={person.id} userId={person.id} name={person.name || undefined} imageTag={person.imageTag} />
              ))}
              {own && artists.data?.map((artist) => <MusicCard key={artist.Id} item={artist} />)}
            </CardRow>
          )}
        </div>
      </div>

      {own && <ProfileDetailsDialog open={editing} onOpenChange={setEditing} name={name} tag={tag} />}
    </div>
  )
}

function ArtistRow({ title, subtitle, items, loading }: { title: string; subtitle: string; items?: BaseItemDto[]; loading: boolean }) {
  if (!loading && !items?.length) return null
  return (
    <CardRow title={title} subtitle={subtitle} loading={loading}>
      {items?.map((artist) => <MusicCard key={artist.Id} item={artist} />)}
    </CardRow>
  )
}

/** Spotify's "Profile details": the picture to change or remove, the name (read-only: it is the sign-in name). */
function ProfileDetailsDialog({ open, onOpenChange, name, tag }: { open: boolean; onOpenChange: (open: boolean) => void; name: string; tag?: string | null }) {
  const t = useMessages(messages)
  const { api, session } = useAuthedSession()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    // The new tag makes every picture of the user reload.
    await queryClient.invalidateQueries({ queryKey: ['user-config', session.userId] })
    await queryClient.invalidateQueries({ queryKey: ['profile', session.userId] })
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error(t.notAnImage)
    setBusy(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      // Jellyfin reads the body as base64 text (like jellyfin-web sends it).
      await getImageApi(api).postUserImage({ userId: session.userId, body: base64 as unknown as File }, { headers: { 'Content-Type': file.type } })
      toast.success(t.photoUpdated)
      await refresh()
    } catch {
      toast.error(t.photoFailed)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await getImageApi(api).deleteUserImage({ userId: session.userId })
      toast.success(t.photoRemoved)
      await refresh()
    } catch {
      toast.error(t.photoFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg">
        <DialogTitle className="text-2xl font-bold">{t.details}</DialogTitle>
        <div className="grid items-center gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="group relative mx-auto size-44">
            <ProfileAvatar userId={session.userId} name={name} tag={tag} className="size-44 text-5xl shadow-2xl shadow-black/40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/60 text-sm font-semibold text-white opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="hover:underline">
                {t.choosePhoto}
              </button>
              <IconPencil className="my-1 size-8" stroke={1.5} />
              {tag && (
                <button type="button" disabled={busy} onClick={() => void remove()} className="hover:underline">
                  {t.removePhoto}
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                void upload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
          <div className="space-y-3">
            <Input value={name} readOnly aria-label={t.profile} className="h-10 bg-foreground/10" />
            <p className="text-xs text-muted-foreground">{t.nameHint}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-full bg-foreground px-7 text-sm font-bold text-background transition-transform hover:scale-[1.03]"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t.photoHint}</p>
      </DialogContent>
    </Dialog>
  )
}

export function ProfileCard({ userId, name, imageTag, className }: { userId: string; name?: string | null; imageTag?: string | null; className?: string }) {
  const t = useMessages(messages)
  const profile = useProfile(name ? undefined : userId)
  const shown = name ?? profile.data?.Name ?? t.unknown
  return (
    <Link to={`/listen/user/${userId}`} className={cn('w-44 shrink-0 rounded-lg p-3 transition-colors duration-300 hover:bg-foreground/[0.07]', className)}>
      <ProfileAvatar userId={userId} name={shown} tag={imageTag ?? profile.data?.PrimaryImageTag} className="aspect-square w-full text-4xl shadow-lg shadow-black/40" />
      <p className="mt-3 truncate text-sm font-semibold">{shown}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{t.profile}</p>
    </Link>
  )
}

type FollowFilter = 'all' | 'artists' | 'profiles'

/**
 * Everyone a person follows, or who follows them, as Spotify shows it: a grid of round pictures; "Following" with
 * filters for artists and profiles (artists only on the user's own profile: whom others follow among artists isn't
 * shared).
 */
export function FollowListPage({ kind }: { kind: 'following' | 'followers' }) {
  const { id = '' } = useParams()
  const t = useMessages(messages)
  const { session } = useAuthedSession()
  const userId = id === 'me' ? session.userId : id
  const own = userId === session.userId
  const socialMe = useSocialMe()
  const socialOther = useSocialProfile(own ? undefined : userId)
  const social = own ? socialMe.data : socialOther.data
  const artists = useFollowedArtists()
  const [filter, setFilter] = useState<FollowFilter>('all')
  const people = (kind === 'followers' ? social?.followers : social?.following) ?? null
  const ownArtists = kind === 'following' && own ? (artists.data ?? []) : []
  const loading = (own ? socialMe.isLoading : socialOther.isLoading) || (kind === 'following' && own && artists.isLoading)
  const showPeople = filter !== 'artists'
  const showArtists = filter !== 'profiles'
  const empty = !loading && !(people?.length ?? 0) && !ownArtists.length
  const filters: Array<[FollowFilter, string]> = [
    ['all', t.all],
    ['artists', t.artistsFilter],
    ['profiles', t.profilesFilter],
  ]
  return (
    <div className="space-y-5 px-4 pb-12 pt-20 sm:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">{kind === 'followers' ? t.followersRow : t.followingRow}</h1>
      {kind === 'following' && own && (
        <div className="flex gap-2">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn('rounded-full px-3 py-1.5 text-sm transition-colors', filter === value ? 'bg-foreground text-background' : 'bg-foreground/10 text-foreground hover:bg-foreground/20')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {social && people === null && !ownArtists.length && <p className="text-sm text-muted-foreground">{t.hidden}</p>}
      {empty && people !== null && <p className="text-sm text-muted-foreground">{kind === 'followers' ? t.noFollowers : t.nobodyFollowed}</p>}
      <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
        {loading && Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="m-3 aspect-square rounded-full" />)}
        {showArtists && ownArtists.map((artist) => <MusicCard key={artist.Id} item={artist} className="w-auto" />)}
        {showPeople &&
          people?.map((person) => <ProfileCard key={person.id} userId={person.id} name={person.name || undefined} imageTag={person.imageTag} className="w-auto" />)}
      </div>
    </div>
  )
}

