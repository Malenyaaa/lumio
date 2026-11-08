import { NavLink, Outlet, useLocation } from 'react-router'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { fieldMessages } from './messages'
import { useSettingsPages } from './settings-pages'

/** Settings area: a side navigation (a tab strip on narrow screens) next to the active sub-page. */
export function SettingsLayout() {
  const { pathname } = useLocation()
  const settingsPages = useSettingsPages()
  const t = useMessages(fieldMessages)
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-12 pt-20 sm:px-8 md:flex-row md:gap-12">
      <nav aria-label={t.navigation} className="md:sticky md:top-20 md:w-48 md:shrink-0 md:self-start">
        <p className="mb-2 hidden px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:block">{t.navigation}</p>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:flex-col">
          <PageLinks pages={settingsPages.filter((page) => !page.admin)} />
          {/* Server-wide settings, set apart from the personal ones. */}
          {settingsPages.some((page) => page.admin) && (
            <>
              <div role="separator" className="mx-1 w-px shrink-0 self-stretch bg-border md:mx-0 md:my-3 md:h-px md:w-auto" />
              <p className="hidden px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:block">{t.administration}</p>
              <PageLinks pages={settingsPages.filter((page) => page.admin)} />
            </>
          )}
        </div>
      </nav>
      {/* The navigation stays; only the sub-page fades in (no page-wide View Transition, which would redraw the nav). */}
      <div key={pathname} className="min-w-0 flex-1 animate-page-in">
        <Outlet />
      </div>
    </div>
  )
}

function PageLinks({ pages }: { pages: ReturnType<typeof useSettingsPages> }) {
  return (
    <ul className="flex gap-1 md:flex-col">
      {pages.map(({ to, label, icon: Icon }) => (
        <li key={to} className="shrink-0">
          <NavLink
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'bg-muted font-medium' : 'text-foreground/70',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
