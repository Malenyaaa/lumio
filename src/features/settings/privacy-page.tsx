import { useSetPrivacy, useSocialMe, type SocialPrivacy } from '@/features/social/social'
import { defineMessages, useMessages } from '@/lib/i18n'
import { Section, SettingsPage, SettingsPending, SwitchField } from './fields'

const messages = defineMessages({
  de: {
    title: 'Privatsphäre',
    description: 'Was andere auf deinem Profil sehen und was deine Freund*innen von deiner Aktivität mitbekommen. Freund*innen sind Leute, denen du folgst und die dir folgen.',
    profile: 'Profil',
    showPlaylists: 'Öffentliche Playlists auf dem Profil zeigen',
    showPlaylistsHint: 'Andere sehen deine öffentlichen Playlists auf deinem Profil.',
    showFollowing: 'Zeigen, wem du folgst',
    showFollowingHint: 'Andere sehen auf deinem Profil, welchen Leuten du folgst.',
    showFollowers: 'Zeigen, wer dir folgt',
    showFollowersHint: 'Andere sehen auf deinem Profil, wer dir folgt. Die Anzahl ist immer sichtbar.',
    activity: 'Aktivität',
    shareActivity: 'Höraktivität mit Freund*innen teilen',
    shareActivityHint: 'Deine Freund*innen sehen, was du gerade hörst oder schaust, und was zuletzt.',
  },
  en: {
    title: 'Privacy',
    description: 'What others see on your profile and what your friends see of your activity. Friends are people you follow who follow you back.',
    profile: 'Profile',
    showPlaylists: 'Show public playlists on your profile',
    showPlaylistsHint: 'Others see your public playlists on your profile.',
    showFollowing: 'Show who you follow',
    showFollowingHint: 'Others see on your profile which people you follow.',
    showFollowers: 'Show who follows you',
    showFollowersHint: 'Others see on your profile who follows you. The number is always visible.',
    activity: 'Activity',
    shareActivity: 'Share listening activity with friends',
    shareActivityHint: 'Your friends see what you are listening to or watching right now, and what you played last.',
  },
})

/** The user's privacy choices, kept on the Lumio server (which also enforces them). */
export function PrivacyPage() {
  const t = useMessages(messages)
  const me = useSocialMe()
  const save = useSetPrivacy()
  if (!me.data) {
    return (
      <SettingsPage title={t.title}>
        <SettingsPending error={me.isError} onRetry={() => void me.refetch()} rows={4} />
      </SettingsPage>
    )
  }
  const privacy = me.data.privacy as SocialPrivacy
  const toggle = (key: keyof SocialPrivacy) => (checked: boolean) => save.mutate({ [key]: checked })
  return (
    <SettingsPage title={t.title} description={t.description}>
      <Section title={t.profile} scope="account">
        <SwitchField id="privacy-playlists" label={t.showPlaylists} hint={t.showPlaylistsHint} checked={privacy.showPlaylists} onChange={toggle('showPlaylists')} />
        <SwitchField id="privacy-following" label={t.showFollowing} hint={t.showFollowingHint} checked={privacy.showFollowing} onChange={toggle('showFollowing')} />
        <SwitchField id="privacy-followers" label={t.showFollowers} hint={t.showFollowersHint} checked={privacy.showFollowers} onChange={toggle('showFollowers')} />
      </Section>
      <Section title={t.activity} scope="account">
        <SwitchField id="privacy-activity" label={t.shareActivity} hint={t.shareActivityHint} checked={privacy.shareActivity} onChange={toggle('shareActivity')} />
      </Section>
    </SettingsPage>
  )
}
