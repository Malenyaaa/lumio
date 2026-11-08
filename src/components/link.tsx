import type { RefAttributes } from 'react'
import { Link as RouterLink, useLocation, useResolvedPath, type LinkProps } from 'react-router'

/**
 * In-app link whose navigation is wrapped in a View Transition (a cross-fade; browsers without support just navigate).
 * A link to the page already open does nothing: navigating there again would only flash the page through the
 * transition, as if it reloaded.
 */
export function Link({ onClick, ...props }: LinkProps & RefAttributes<HTMLAnchorElement>) {
  const location = useLocation()
  const target = useResolvedPath(props.to)
  const here = target.pathname === location.pathname && target.search === location.search && !target.hash
  return (
    <RouterLink
      viewTransition
      {...props}
      onClick={(event) => {
        onClick?.(event)
        // Only a plain click; modified clicks (new tab, new window) still open the link.
        const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
        if (here && plain && !event.defaultPrevented) event.preventDefault()
      }}
    />
  )
}
