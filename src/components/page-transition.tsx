import { useLayoutEffect, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document

/** Sections with their own navigation: moving between their sub-pages keeps the frame and only swaps the content. */
const SECTIONS = ['/settings']

/** Scroll positions of pages left, by history entry, for frames that scroll in a panel of their own (Listen). */
const positions = new Map<string, number>()

/** The frame's scrolling panel, where it has one (`data-scroll-root`); otherwise the window scrolls. */
export const scrollRoot = () => document.querySelector<HTMLElement>('[data-scroll-root]')

const pageKey = (pathname: string) => SECTIONS.find((section) => pathname === section || pathname.startsWith(`${section}/`)) ?? pathname

/**
 * Pages animate in with a CSS fade, except when a link already runs a View Transition (forward navigation in browsers
 * that support it), which would double up. Also resets scroll on forward navigation; back/forward keep the position.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname, key } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    const root = scrollRoot()
    if (!root) {
      if (navigationType !== 'POP') window.scrollTo(0, 0)
      return
    }
    // The browser only restores the window's position; a panel's is put back here.
    if (navigationType === 'POP') {
      const top = positions.get(key) ?? 0
      requestAnimationFrame(() => root.scrollTo(0, top))
    } else root.scrollTo(0, 0)
    return () => {
      positions.set(key, root.scrollTop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const viewTransitionRuns = supportsViewTransitions && navigationType === 'PUSH'
  return (
    <div key={pageKey(pathname)} className={viewTransitionRuns ? undefined : 'animate-page-in'}>
      {children}
    </div>
  )
}
