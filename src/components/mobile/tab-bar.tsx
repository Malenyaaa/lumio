import type { Icon } from '@tabler/icons-react'
import { NavLink } from 'react-router'
import { shellMessages } from '@/components/messages'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface Tab {
  to: string
  label: string
  icon: Icon
  /** Shown while the tab is current (a filled variant). */
  activeIcon?: Icon
  /** Only this exact address counts as the tab (start pages). */
  end?: boolean
  /** Further addresses that belong to the tab. */
  match?: (pathname: string) => boolean
}

/**
 * The phone's main navigation along the bottom, within thumb reach (as in Spotify). It fades up from the page instead
 * of sitting on a hard edge, and keeps clear of the home indicator.
 */
export function TabBar({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  const t = useMessages(shellMessages)
  return (
    <nav
      aria-label={t.tabs}
      data-tab-bar
      // Its own layer in page transitions: it stays put while the page changes (index.css).
      className="[view-transition-name:app-tabs] fixed inset-x-0 bottom-0 z-40 bg-linear-to-t from-background from-65% to-background/0 pt-3 pb-(--safe-bottom) md:hidden"
    >
      <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            viewTransition
            className={({ isActive }) => {
              const current = isActive || !!tab.match?.(pathname)
              return cn(
                'flex flex-col items-center justify-center gap-1 text-[11px] outline-none transition-colors focus-visible:text-foreground',
                current ? 'font-medium text-foreground' : 'text-muted-foreground',
              )
            }}
          >
            {({ isActive }) => {
              const current = isActive || !!tab.match?.(pathname)
              const TabIcon = current && tab.activeIcon ? tab.activeIcon : tab.icon
              return (
                <>
                  <TabIcon className="size-6" stroke={current ? 2.25 : 1.75} />
                  <span className="max-w-full truncate px-1">{tab.label}</span>
                </>
              )
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
