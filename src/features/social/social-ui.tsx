import { IconActivityHeartbeat, IconDeviceTv, IconMusic } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link } from '@/components/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ProfileAvatar } from '@/features/listen/profile-page'
import { defineMessages, getLocaleTag, useLocale, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useFriendActivity, type SocialActivity } from './social'

const messages = defineMessages({
  de: {
    friendActivity: 'Aktivität von Freund*innen',
    title: 'Höraktivität',
    empty: 'Wenn ihr euch gegenseitig folgt, siehst du hier, was deine Freund*innen gerade hören und schauen.',
    now: 'Jetzt',
    listening: 'Hört gerade',
    watching: 'Schaut gerade',
    last: 'Zuletzt',
  },
  en: {
    friendActivity: 'Friend activity',
    title: 'Friend activity',
    empty: 'When you follow each other, you see here what your friends are listening to and watching.',
    now: 'Now',
    listening: 'Listening to',
    watching: 'Watching',
    last: 'Last',
  },
})

/** Playing and reported in the last ten minutes counts as "now". */
const NOW_MS = 10 * 60_000

/** "now", "5 min.", "2 hr." … refreshing every minute. */
export function useRelativeTime(at: number | undefined) {
  const locale = getLocaleTag(useLocale())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!at) return ''
  const minutes = Math.round((now - at) / 60_000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (minutes < 60) return format.format(-Math.max(1, minutes), 'minute')
  if (minutes < 60 * 24) return format.format(-Math.round(minutes / 60), 'hour')
  return format.format(-Math.round(minutes / (60 * 24)), 'day')
}

export const isLive = (activity: SocialActivity | null | undefined, now = Date.now()) => !!activity?.playing && now - activity.at < NOW_MS

/** Where an activity leads: the album, podcast or series it belongs to. */
export function activityHref(activity: SocialActivity) {
  if (!activity.contextId) return undefined
  if (activity.kind === 'video') return `/show/${activity.contextId}`
  return /^\d+$/.test(activity.contextId) ? `/listen/podcast/${activity.contextId}` : `/listen/album/${activity.contextId}`
}

/** One friend's activity: what plays, by whom, from where, and when (a green dot while it plays now). */
export function ActivityLine({ activity, compact }: { activity: SocialActivity; compact?: boolean }) {
  const t = useMessages(messages)
  const when = useRelativeTime(activity.at)
  const live = isLive(activity)
  const Icon = activity.kind === 'video' ? IconDeviceTv : IconMusic
  const href = activityHref(activity)
  return (
    <div className="min-w-0 text-sm">
      <p className="truncate">
        <span className="font-medium">{activity.name}</span>
        {activity.subtitle && <span className="text-muted-foreground"> • {activity.subtitle}</span>}
      </p>
      {!compact && activity.context && (
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          {href ? (
            <Link to={href} className="truncate hover:text-foreground hover:underline">
              {activity.context}
            </Link>
          ) : (
            <span className="truncate">{activity.context}</span>
          )}
        </p>
      )}
      <p className={cn('text-xs', live ? 'flex items-center gap-1.5 text-listen' : 'text-muted-foreground')}>
        {live && <span className="size-1.5 animate-pulse rounded-full bg-listen" />}
        {live ? t.now : when}
      </p>
    </div>
  )
}

/**
 * The header button for friends' activity (people who follow each other): what they play right now or last, live, as
 * in Spotify's friend activity. Only there with the Lumio server.
 */
export function FriendActivityButton() {
  const t = useMessages(messages)
  const activity = useFriendActivity()
  const list = activity.data ?? []
  const anyLive = list.some((entry) => isLive(entry.activity))
  return (
    <Popover>
      {/* Same as the header's other buttons; a pulse, so it isn't mistaken for "watch together" (people). */}
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={t.friendActivity} title={t.friendActivity} className="relative" />}>
        <IconActivityHeartbeat />
        {anyLive && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-listen ring-2 ring-background" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-3 text-sm font-bold">{t.title}</p>
        <div className="max-h-[60svh] overflow-y-auto p-2 [scrollbar-width:thin]">
          {list.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">{t.empty}</p>}
          {list.map(({ user, activity: entry }) =>
            entry ? (
              <Link key={user.id} to={`/listen/user/${user.id}`} className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted">
                <ProfileAvatar userId={user.id} name={user.name} tag={user.imageTag} className="size-10 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{user.name}</span>
                  <ActivityLine activity={entry} />
                </span>
              </Link>
            ) : null,
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
