import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { Link } from '@/components/link'
import { inMode, useAppMode } from '@/lib/app-mode'
import { useMessages } from '@/lib/i18n'
import { usePhone } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { fieldMessages } from './messages'
import { SETTINGS_GROUPS, useGroupNames, useSettingsPages, type SettingsPageLink } from './settings-pages'

/**
 * Settings area. Wide screens: a side navigation in groups next to the active sub-page. Phones: /settings is a list of
 * the pages (as in the phone's own settings), each page opens on its own with a way back to the list.
 */
export function SettingsLayout() {
  const { pathname } = useLocation()
  const phone = usePhone()
  const mode = useAppMode()
  const t = useMessages(fieldMessages)
  const atIndex = /\/settings\/?$/.test(pathname)

  if (phone) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-20">
        {atIndex ? (
          <div className="animate-page-in space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">{t.navigation}</h1>
            <PageList />
          </div>
        ) : (
          <div key={pathname} className="animate-page-in space-y-4">
            <Link to={inMode(mode, '/settings')} className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <IconChevronLeft className="size-4" /> {t.navigation}
            </Link>
            <Outlet />
          </div>
        )}
      </div>
    )
  }

  // Wide screens open the first page right away.
  if (atIndex) return <Navigate to="profile" replace />
  return (
    <div className="mx-auto flex max-w-5xl flex-row gap-12 px-8 pb-12 pt-20">
      <SideNav />
      {/* The navigation stays; only the sub-page fades in (no page-wide View Transition, which would redraw the nav). */}
      <div key={pathname} className="min-w-0 flex-1 animate-page-in">
        <Outlet />
      </div>
    </div>
  )
}

/** The pages by group, in the order of `SETTINGS_GROUPS`; empty groups are left out. */
function useGrouped() {
  const pages = useSettingsPages()
  const names = useGroupNames()
  return SETTINGS_GROUPS.map((group) => ({ group, title: names[group], pages: pages.filter((page) => page.group === group) })).filter(
    (entry) => entry.pages.length,
  )
}

function SideNav() {
  const t = useMessages(fieldMessages)
  const groups = useGrouped()
  return (
    <nav aria-label={t.navigation} className="sticky top-20 w-52 shrink-0 self-start">
      <div className="space-y-4">
        {groups.map(({ group, title, pages }) => (
          <div key={group}>
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <ul className="flex flex-col gap-0.5">
              {pages.map((page) => (
                <li key={page.to}>
                  <SideLink page={page} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

function SideLink({ page: { to, label, icon: Icon } }: { page: SettingsPageLink }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
          isActive ? 'bg-muted font-medium' : 'text-foreground/70',
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}

/** The phone's settings list: one card per group, a row per page. */
function PageList() {
  const groups = useGrouped()
  return (
    <div className="space-y-5">
      {groups.map(({ group, title, pages }) => (
        <section key={group} className="space-y-2">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {pages.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="flex items-center gap-3 px-4 py-3.5 text-sm outline-none transition-colors active:bg-muted focus-visible:bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  <IconChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
