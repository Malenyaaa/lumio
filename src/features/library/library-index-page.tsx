import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models'
import { IconChevronRight } from '@tabler/icons-react'
import { Link } from '@/components/link'
import { FadeImage } from '@/components/media/fade-image'
import { shellMessages } from '@/components/messages'
import { Skeleton } from '@/components/ui/skeleton'
import { usePluginRegistry } from '@/features/admin/plugins'
import { useAuthedSession } from '@/features/auth/session'
import { useMessages } from '@/lib/i18n'
import { landscapeImageUrl } from '@/lib/images'
import { categoryPath, useCategories } from './categories'

/**
 * Watch's Library tab on phones: every kind of media (and the libraries that fit no kind) as a tile, where the desktop
 * header lists them as links.
 */
export function LibraryIndexPage() {
  const t = useMessages(shellMessages)
  const { categories, others, isLoading } = useCategories('watch')
  const { navLinks } = usePluginRegistry()
  const entries = [
    ...categories.map((category) => ({ key: category.id, to: categoryPath(category.id), label: category.label, view: category.views[0] })),
    ...others.map((view) => ({ key: view.Id!, to: `/library/${view.Id}`, label: view.Name ?? '', view })),
  ]
  return (
    <div className="space-y-6 px-4 pb-8 pt-20 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.library}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="aspect-video rounded-xl" />)
          : entries.map((entry) => <Tile key={entry.key} to={entry.to} label={entry.label} view={entry.view} />)}
      </div>
      {navLinks.length > 0 && (
        <div className="divide-y rounded-xl border">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              to={link.href}
              {...(link.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              className="flex items-center justify-between px-4 py-3.5 text-[15px]"
            >
              {link.label}
              <IconChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** A library's own picture (set in Jellyfin; it usually carries the name already), else its name on a plain tile. */
function Tile({ to, label, view }: { to: string; label: string; view?: BaseItemDto }) {
  const { api } = useAuthedSession()
  const image = view?.ImageTags?.Primary ? landscapeImageUrl(api, view, { fillWidth: 400 }) : undefined
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative isolate grid aspect-video place-items-center overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {image ? <FadeImage src={image} alt="" className="absolute inset-0 -z-10 size-full object-cover" /> : <span className="px-3 text-center font-semibold">{label}</span>}
    </Link>
  )
}
