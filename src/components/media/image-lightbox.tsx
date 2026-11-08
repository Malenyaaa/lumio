import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { IconX } from '@tabler/icons-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { uiMessages } from '@/components/messages'
import { useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const DURATION = 320
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** The large picture's box: as big as the screen allows, in the small picture's proportions. */
function targetSize(aspect: number) {
  const margin = window.innerWidth >= 640 ? 96 : 48
  const width = Math.min(window.innerWidth - margin, (window.innerHeight - margin) * aspect)
  return { width, height: width / aspect }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The transform that puts the large picture exactly over the small one. */
function fromSmall(small: DOMRect, large: DOMRect) {
  return `translate(${small.left - large.left}px, ${small.top - large.top}px) scale(${small.width / large.width}, ${small.height / large.height})`
}

/**
 * A picture that opens large on click, as in music apps (a cover or an artist photo): it grows out of its place on
 * the page to as big as the screen allows while the page dims, and shrinks back into its place when closed (a click
 * anywhere, Escape or the close button).
 */
export function ImageLightbox({
  src,
  label,
  round,
  className,
  children,
}: {
  /** The large version shown when open. */
  src: string | undefined
  /** What the picture is, for the button and the dialog. */
  label: string
  /** Shows the large picture as a circle (artist photos). */
  round?: boolean
  className?: string
  /** The small picture on the page. */
  children: ReactNode
}) {
  const t = useMessages(uiMessages)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [placeholder, setPlaceholder] = useState<string>()
  const trigger = useRef<HTMLButtonElement>(null)
  const image = useRef<HTMLImageElement>(null)
  // Set at once (a click on the close button also reaches the popup's own click), unlike the state.
  const shrinking = useRef(false)

  const show = () => {
    const small = trigger.current?.getBoundingClientRect()
    if (!small?.width) return
    setSize(targetSize(small.width / small.height))
    // The small picture fills in while the large one loads.
    setPlaceholder(trigger.current?.querySelector('img')?.currentSrc || undefined)
    shrinking.current = false
    setClosing(false)
    setOpen(true)
  }

  const hide = () => {
    const small = trigger.current?.getBoundingClientRect()
    const large = image.current
    if (shrinking.current) return
    shrinking.current = true
    if (!small || !large || reducedMotion()) return setOpen(false)
    setClosing(true)
    for (const running of large.getAnimations()) running.cancel()
    const animation = large.animate([{ transform: 'none' }, { transform: fromSmall(small, large.getBoundingClientRect()) }], {
      duration: DURATION * 0.85,
      easing: EASING,
      fill: 'forwards',
    })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setOpen(false)
      setClosing(false)
    }
    animation.onfinish = finish
    // A hidden tab runs no animations; the dialog still closes.
    window.setTimeout(finish, DURATION + 150)
  }

  // Grows out of the small picture as soon as the large one is on the screen (the portal mounts it a moment after the
  // dialog opens, so this hangs on the element rather than on `open`).
  // Stable, so re-renders (closing) don't run it again.
  const attach = useCallback((node: HTMLImageElement | null) => {
    image.current = node
    if (!node || !trigger.current || reducedMotion()) return
    // React may attach it twice (strict mode); measured mid-animation, the second run would start where it already is.
    for (const animation of node.getAnimations()) animation.cancel()
    const small = trigger.current.getBoundingClientRect()
    node.animate([{ transform: fromSmall(small, node.getBoundingClientRect()) }, { transform: 'none' }], { duration: DURATION, easing: EASING })
  }, [])

  if (!src) return <div className={className}>{children}</div>
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? show() : hide())}>
      <DialogPrimitive.Trigger
        ref={trigger}
        aria-label={label}
        className={cn('cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      >
        {children}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm transition-opacity duration-300 data-open:animate-in data-open:fade-in-0',
            closing && 'opacity-0',
          )}
        />
        <DialogPrimitive.Popup aria-label={label} onClick={hide} className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center outline-none">
          <img
            ref={attach}
            src={src}
            alt={label}
            style={{ width: size.width, height: size.height, backgroundImage: placeholder ? `url("${placeholder}")` : undefined }}
            className={cn('origin-top-left bg-cover bg-center object-cover shadow-2xl shadow-black/60', round ? 'rounded-full' : 'rounded-lg')}
          />
          <DialogPrimitive.Close
            aria-label={t.close}
            className={cn(
              'absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-[background-color,opacity] hover:bg-white/20',
              closing && 'opacity-0',
            )}
          >
            <IconX className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
