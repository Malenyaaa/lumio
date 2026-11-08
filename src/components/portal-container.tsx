import { createContext, useContext } from 'react'

/**
 * Where popups (popovers) render their portal. Normally `<body>`; the player provides its own root instead, because in
 * fullscreen only the fullscreen element and its descendants are visible.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null)

export const usePortalContainer = () => useContext(PortalContainerContext) ?? undefined
