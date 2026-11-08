import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAuthedSession } from '@/features/auth/session'
import { lumioGet, useSocialMe, type SocialPerson } from '@/features/social/social'
import { defineMessages, useMessages } from '@/lib/i18n'
import { ProfileAvatar } from './profile-page'
import { usePlaylistActions } from './playlists'
import { useProfile } from './profiles'

const messages = defineMessages({
  de: {
    title: 'Gemeinsame Playlist',
    description: 'Mitwirkende können Songs hinzufügen, entfernen und umsortieren. In der Playlist steht dann, wer welchen Song hinzugefügt hat.',
    editors: 'Mitwirkende',
    invite: 'Einladen',
    candidates: 'Leute, denen du folgst',
    add: 'Hinzufügen',
    remove: 'Entfernen',
    you: 'Du (Ersteller*in)',
    nobody: 'Folge Leuten, um sie einladen zu können.',
  },
  en: {
    title: 'Shared playlist',
    description: 'Collaborators can add, remove and reorder songs. The playlist then shows who added each song.',
    editors: 'Collaborators',
    invite: 'Invite',
    candidates: 'People you follow',
    add: 'Add',
    remove: 'Remove',
    you: 'You (creator)',
    nobody: 'Follow people to be able to invite them.',
  },
})

/** Who added each song to a playlist (through Lumio), by track id. */
export function usePlaylistAdds(playlistId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['playlist-adds', playlistId],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await lumioGet(`/playlists/adds?playlistId=${playlistId}`)
      if (!response?.ok) throw new Error('Lumio server unavailable')
      return (await response.json()) as Record<string, { person: SocialPerson; at: number }>
    },
  })
}

function EditorRow({ userId, own, onRemove, pending }: { userId: string; own: boolean; onRemove?: () => void; pending: boolean }) {
  const t = useMessages(messages)
  const name = useProfile(userId).data?.Name
  return (
    <li className="flex items-center gap-3 py-2">
      <ProfileAvatar userId={userId} name={name} className="size-8 text-xs" />
      <span className="min-w-0 flex-1 truncate text-sm">{own ? t.you : (name ?? '…')}</span>
      {onRemove && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={onRemove}>
          {t.remove}
        </Button>
      )}
    </li>
  )
}

/** Sharing a playlist with people the user follows, who may then edit it with them. */
export function PlaylistShareDialog({ playlistId, editors, open, onOpenChange }: { playlistId: string; editors: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useMessages(messages)
  const { session } = useAuthedSession()
  const me = useSocialMe()
  const actions = usePlaylistActions()
  const people = [...(me.data?.friends ?? []), ...(me.data?.following ?? [])].filter(
    (person, index, list) => person.id !== session.userId && !editors.includes(person.id) && list.findIndex((other) => other.id === person.id) === index,
  )
  const set = (userId: string, canEdit: boolean) => actions.share.mutate({ playlistId, userId, canEdit })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-md">
        <div className="space-y-1 pr-8">
          <DialogTitle className="text-xl font-bold">{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </div>
        <div className="-mx-6 -mb-6 min-h-0 space-y-5 overflow-y-auto px-6 pb-6">
          <section>
            <h3 className="text-sm font-semibold">{t.editors}</h3>
            <ul className="divide-y">
              {editors.map((userId) => (
                <EditorRow
                  key={userId}
                  userId={userId}
                  own={userId === session.userId}
                  pending={actions.share.isPending}
                  onRemove={userId === session.userId ? undefined : () => set(userId, false)}
                />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-semibold">{t.candidates}</h3>
            {!people.length && <p className="py-2 text-sm text-muted-foreground">{t.nobody}</p>}
            <ul className="divide-y">
              {people.map((person) => (
                <li key={person.id} className="flex items-center gap-3 py-2">
                  <ProfileAvatar userId={person.id} name={person.name} tag={person.imageTag} className="size-8 text-xs" />
                  <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
                  <Button size="sm" variant="outline" disabled={actions.share.isPending} onClick={() => set(person.id, true)}>
                    {t.add}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
