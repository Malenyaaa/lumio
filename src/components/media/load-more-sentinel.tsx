import { IconLoader2 } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'

interface LoadMoreSentinelProps {
  loading?: boolean
  onLoadMore: () => void
}

/** Sits below a list and calls `onLoadMore` once it scrolls near the viewport. Render it only while more pages exist. */
export function LoadMoreSentinel({ loading, onLoadMore }: LoadMoreSentinelProps) {
  const node = useRef<HTMLDivElement>(null)
  // Callers pass inline callbacks; keeping it in a ref stops every re-render from re-creating the observer (each new
  // observer reports "intersecting" right away and would request the same page again).
  const loadMore = useRef(onLoadMore)
  useEffect(() => {
    loadMore.current = onLoadMore
  })

  // Re-created when a page finishes loading: if the sentinel is still in view then, the fresh observer asks for the next.
  useEffect(() => {
    const element = node.current
    if (!element || loading) return
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore.current(), { rootMargin: '800px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading])

  return (
    <div ref={node} className="flex h-16 items-center justify-center text-muted-foreground">
      {loading && <IconLoader2 className="size-5 animate-spin" />}
    </div>
  )
}
