import { currentTheme, subscribeTheme } from '@/lib/theme'

/**
 * Lumio's desktop app (Electron, electron/preload.cjs): its own settings, the window buttons' colors, and the tray
 * (what plays, and its play/next commands). Undefined in a browser and on Android.
 */
export interface DesktopSettings {
  /** Start with the system. */
  autostart: boolean
  /** Started with the system: only into the tray, no window. */
  startHidden: boolean
  /** Which app opens: the one used last, Watch or Listen. */
  startIn: 'last' | 'watch' | 'listen'
  /** What closing the window does: keep Lumio in the tray, only minimize it (music plays on either way), or quit. */
  closeAction: 'tray' | 'minimize' | 'quit'
  /** The window buttons in Lumio's header instead of the system's frame (takes a restart). */
  frameless: boolean
}

interface LumioDesktop {
  platform: string
  getSettings(): Promise<DesktopSettings>
  setSettings(patch: Partial<DesktopSettings>): Promise<DesktopSettings>
  relaunch(): Promise<void>
  setTheme(theme: 'dark' | 'light'): void
  setNowPlaying(info: { title: string; playing: boolean; loaded: boolean }): void
  onMediaCommand(handler: (command: 'toggle' | 'next') => void): () => void
}

export const desktop = (): LumioDesktop | undefined => (typeof window === 'undefined' ? undefined : (window as { lumioDesktop?: LumioDesktop }).lumioDesktop)

/**
 * At start: marks the page as the desktop app (index.css then keeps room for the window buttons in the headers and lets
 * them move the window), and keeps the buttons' color with the theme.
 */
export function initDesktop() {
  const app = desktop()
  if (!app) return
  document.documentElement.dataset.desktop = app.platform
  // Only without the system's frame are the window buttons in the header.
  void app.getSettings().then((settings) => {
    if (settings.frameless) document.documentElement.dataset.frameless = ''
  })
  app.setTheme(currentTheme())
  subscribeTheme(() => app.setTheme(currentTheme()))
}
