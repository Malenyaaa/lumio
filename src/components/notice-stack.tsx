import { useSyncExternalStore, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * The corner where Lumio's own notice cards sit (the storage notice, the app hint, a ready update). They go into one
 * column, so two at a time stack instead of lying on top of each other.
 */
let host: HTMLElement | null = null
const listeners = new Set<() => void>()

function setHost(next: HTMLElement | null) {
  if (next === host) return
  host = next
  for (const listener of listeners) listener()
}

function useHost() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => host,
    () => null,
  )
}

/** The column itself, once in the app's frame. In Listen it starts above the player bar. */
export function NoticeStack() {
  const listen = useLocation().pathname.startsWith('/listen')
  return (
    <div
      ref={setHost}
      className={cn(
        'pointer-events-none fixed inset-x-4 z-[60] mx-auto flex max-w-lg flex-col-reverse gap-3 empty:hidden',
        listen ? 'bottom-[max(6.5rem,calc(var(--bottom-inset)+1rem))]' : 'bottom-[max(1.5rem,calc(var(--bottom-inset)+1rem))]',
      )}
    />
  )
}

/** A card in the notice column (nothing until the column is there). */
export function NoticeCard({ className, ...props }: ComponentProps<'div'>) {
  const target = useHost()
  if (!target) return null
  return createPortal(
    <div {...props} className={cn('pointer-events-auto rounded-xl bg-popover p-4 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-page-in', className)} />,
    target,
  )
}
