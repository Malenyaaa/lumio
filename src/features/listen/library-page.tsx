import { IconBook, IconMicrophone, IconMusic, IconTicket, type Icon } from '@tabler/icons-react'
import { Link } from '@/components/link'
import { useCategories, type CategoryId } from '@/features/library/categories'
import { defineMessages, useMessages } from '@/lib/i18n'
import { concertsAvailable } from './concerts'
import { LibrarySidebar } from './library-sidebar'

const messages = defineMessages({
  de: { podcasts: 'Podcasts', concerts: 'Konzerte' },
  en: { podcasts: 'Podcasts', concerts: 'Concerts' },
})

const CATEGORY_ICONS: Partial<Record<CategoryId, Icon>> = { music: IconMusic, audiobooks: IconBook }

/**
 * Listen's Library tab on phones: what the sidebar shows on wider screens (playlists, liked songs, followed artists,
 * saved albums, folders), below the ways into the server's audio and the podcast directory.
 */
export function ListenLibraryPage() {
  const t = useMessages(messages)
  const { categories } = useCategories('listen')
  const links = [
    ...categories.map((category) => ({ to: `/listen/browse/${category.id}`, label: category.label, icon: CATEGORY_ICONS[category.id] ?? IconMusic })),
    { to: '/listen/podcasts', label: t.podcasts, icon: IconMicrophone },
    ...(concertsAvailable() ? [{ to: '/listen/concerts', label: t.concerts, icon: IconTicket }] : []),
  ]
  return (
    <div className="space-y-2 pt-16">
      <nav className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {links.map(({ to, label, icon: LinkIcon }) => (
          <Link key={to} to={to} className="flex shrink-0 items-center gap-2 rounded-full bg-muted px-3.5 py-2 text-sm font-medium">
            <LinkIcon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
      {/* Its heading is the page's ("Bibliothek", with "+" to create a playlist or folder). */}
      <LibrarySidebar compact={false} className="bg-transparent px-2" titleClassName="text-2xl tracking-tight" />
    </div>
  )
}
