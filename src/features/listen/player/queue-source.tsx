import { Link } from '@/components/link'
import { useItem } from '@/features/items/queries'
import { defineMessages, useMessages } from '@/lib/i18n'
import { useOfficialPlaylist } from '../official'
import { usePodcast } from '../podcasts'

const messages = defineMessages({
  de: { favorites: 'Favoriten', radio: (name: string) => `Radio: ${name}`, songs: 'deinen Songs' },
  en: { favorites: 'Favorites', radio: (name: string) => `Radio: ${name}`, songs: 'your songs' },
})

/** What a play source (`album:<id>`, `playlist:<id>`, `official:<slug>`, …) is called, and where its page is. */
function useSourceInfo(source: string | null): { name: string; href?: string } {
  const t = useMessages(messages)
  const [kind = '', id = ''] = source ? [source.slice(0, source.indexOf(':')), source.slice(source.indexOf(':') + 1)] : []
  const libraryItem = useItem(id, ['album', 'playlist', 'artist', 'radio'].includes(kind) && !!id)
  const official = useOfficialPlaylist(kind === 'official' ? id : '')
  const podcast = usePodcast(kind === 'podcast' ? id : undefined)
  if (source === 'liked') return { name: t.favorites, href: '/listen/liked' }
  const name = libraryItem.data?.Name ?? ''
  switch (kind) {
    case 'album':
      return { name, href: `/listen/album/${id}` }
    case 'playlist':
      return { name, href: `/listen/playlist/${id}` }
    case 'artist':
      return { name, href: `/listen/artist/${id}` }
    case 'radio':
      return { name: name ? t.radio(name) : '', href: `/listen/official/radio-${id}` }
    case 'official':
      return { name: official.playlist?.title ?? '', href: `/listen/official/${id}` }
    case 'guest':
      return { name: id.replace(/:credited$/, ''), href: `/listen/guest/${encodeURIComponent(id.replace(/:credited$/, ''))}` }
    case 'podcast':
      return { name: podcast.data?.podcast.name ?? '', href: `/listen/podcast/${id}` }
    default:
      return { name: t.songs }
  }
}

/** The name of what is playing (a collection, a show), as a link to its page. */
export function SourceLink({ source }: { source: string | null }) {
  const { name, href } = useSourceInfo(source)
  if (!href) return <>{name}</>
  return (
    <Link to={href} className="hover:underline">
      {name}
    </Link>
  )
}
