import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { cn } from "cn"
import { usePortalContainer } from '@/components/portal-container'

/**
 * A panel that slides in from an edge and follows the finger: the phone's menus, the queue, the profile drawer. Bottom
 * sheets can stop at heights (`snapPoints`, e.g. half and full). Swiping it away, tapping beside it, Escape and the
 * system back button close it.
 *
 * The back gesture: in the browser Base UI's drawer listens for it itself (CloseWatcher); inside Jellyfin's app
 * `goBack` (src/lib/back.ts) closes the open popup with Escape.
 */

type SheetSide = "bottom" | "left" | "right"

const SheetSideContext = React.createContext<SheetSide>("bottom")

const SWIPE: Record<SheetSide, DrawerPrimitive.Root.Props["swipeDirection"]> = { bottom: "down", left: "left", right: "right" }

function Sheet({ side = "bottom", ...props }: DrawerPrimitive.Root.Props & { side?: SheetSide }) {
  return (
    <SheetSideContext.Provider value={side}>
      <DrawerPrimitive.Root data-slot="sheet" swipeDirection={SWIPE[side]} {...props} />
    </SheetSideContext.Provider>
  )
}

function SheetTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="sheet-close" {...props} />
}

const POPUP: Record<SheetSide, string> = {
  bottom:
    "w-full max-h-[calc(100dvh-1rem-env(safe-area-inset-top,0px))] rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)] [transform:translateY(calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)))] data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]",
  left:
    "h-full w-[min(20rem,85vw)] rounded-r-2xl pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] [transform:translateX(var(--drawer-swipe-movement-x))] data-starting-style:[transform:translateX(-100%)] data-ending-style:[transform:translateX(-100%)]",
  right:
    "h-full w-[min(20rem,85vw)] rounded-l-2xl pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] [transform:translateX(var(--drawer-swipe-movement-x))] data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)]",
}

const VIEWPORT: Record<SheetSide, string> = {
  bottom: "items-end justify-center",
  left: "items-stretch justify-start",
  right: "items-stretch justify-end",
}

function SheetContent({
  className,
  children,
  handle,
  ...props
}: DrawerPrimitive.Popup.Props & {
  /** The grab bar at the top of a bottom sheet; on by default there. */
  handle?: boolean
}) {
  const side = React.useContext(SheetSideContext)
  return (
    <DrawerPrimitive.Portal container={usePortalContainer()}>
      <DrawerPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.6*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*350ms)] motion-reduce:transition-none"
      />
      <DrawerPrimitive.Viewport data-slot="sheet-viewport" className={cn("fixed inset-0 z-50 flex", VIEWPORT[side])}>
        <DrawerPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            "flex min-h-0 flex-col bg-popover text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-ending-style:duration-[calc(var(--drawer-swipe-strength)*350ms)] motion-reduce:transition-none",
            POPUP[side],
            className
          )}
          {...props}
        >
          {(handle ?? side === "bottom") && (
            <div aria-hidden className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-foreground/20" />
            </div>
          )}
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

/** The scrolling part of a sheet (below a fixed header, above a fixed footer). */
function SheetBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4", className)}
      {...props}
    />
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex shrink-0 flex-col gap-1 px-4 pt-2 pb-3", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("flex shrink-0 gap-2 border-t px-4 py-3", className)} {...props} />
}

function SheetTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return <DrawerPrimitive.Title data-slot="sheet-title" className={cn("font-heading text-base font-semibold", className)} {...props} />
}

function SheetDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return <DrawerPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
