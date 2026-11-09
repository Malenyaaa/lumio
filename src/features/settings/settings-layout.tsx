import { IconChevronLeft, IconChevronRight, IconSearch, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { Link } from '@/components/link'
import { Input } from '@/components/ui/input'
import { inMode, useAppMode } from '@/lib/app-mode'
import { useMessages } from '@/lib/i18n'
import { usePhone } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { fieldMessages } from './messages'
import { SETTINGS_GROUPS, useGroupNames, useSettingsPages, type SettingsPageLink } from './settings-pages'
import { useSettingsSearch } from './settings-search'

/** Highlight on the row a search result jumps to. */
const FLASH = ['bg-primary/10']

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
  const [query, setQuery] = useState('')
  useJumpToSetting()

  if (phone) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-20">
        {atIndex ? (
          <div className="animate-page-in space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">{t.navigation}</h1>
            <SearchBox query={query} onChange={setQuery} />
            {query.trim() ? <SearchResults query={query} onPick={() => setQuery('')} /> : <PageList />}
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
      {/* At most the scrolling area's height (minus the top offset and the bottom padding): a taller nav would be pushed
          up by the end of the page while scrolling and snap back on the next page. The list scrolls on its own instead.
          That area is the window, or Listen's content panel, which sets these values (see ListenShell). */}
      <nav
        aria-label={t.navigation}
        className="sticky top-(--sticky-top,5rem) flex max-h-[calc(var(--scroll-root-height,100dvh)-var(--sticky-top,5rem)-var(--sticky-bottom,3rem))] w-56 shrink-0 flex-col gap-4 self-start"
      >
        <SearchBox query={query} onChange={setQuery} />
        <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-1 [scrollbar-width:thin]">
          {query.trim() ? <SearchResults query={query} onPick={() => setQuery('')} /> : <SideNav />}
        </div>
      </nav>
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
  const groups = useGrouped()
  return (
    <div>
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
    </div>
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

function SearchBox({ query, onChange }: { query: string; onChange: (query: string) => void }) {
  const t = useMessages(fieldMessages)
  return (
    <div className="relative">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onChange('')}
        placeholder={t.search}
        aria-label={t.search}
        className="h-9 pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button type="button" aria-label={t.clearSearch} onClick={() => onChange('')} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground">
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** Settings matching the search, each leading to its row. */
function SearchResults({ query, onPick }: { query: string; onPick: () => void }) {
  const t = useMessages(fieldMessages)
  const results = useSettingsSearch(query)
  if (!results.length) return <p className="px-1 text-sm text-muted-foreground">{t.noResults}</p>
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card md:divide-y-0 md:rounded-none md:border-0 md:bg-transparent">
      {results.slice(0, 30).map((result) => (
        <li key={result.key}>
          <Link to={result.to} onClick={onPick} className="block px-4 py-3 outline-none transition-colors hover:bg-muted focus-visible:bg-muted md:rounded-md md:px-3 md:py-2">
            <span className="block text-sm font-medium">{result.label}</span>
            <span className="block text-xs text-muted-foreground">{result.page}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * A link with #id (from the search) scrolls to that row or section once the page shows it (account settings load
 * first) and lights it up briefly.
 */
function useJumpToSetting() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (!id) return
    let tries = 0
    let clear: number | undefined
    const find = window.setInterval(() => {
      const target = document.getElementById(id)
      if (!target && ++tries < 40) return
      window.clearInterval(find)
      const row = target?.closest<HTMLElement>('[data-setting-row]') ?? target
      if (!row) return
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row.classList.add(...FLASH)
      clear = window.setTimeout(() => row.classList.remove(...FLASH), 1800)
    }, 100)
    return () => {
      window.clearInterval(find)
      window.clearTimeout(clear)
    }
  }, [pathname, hash])
}
