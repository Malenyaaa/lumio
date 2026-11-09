import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'

/**
 * Lumio's own Android app (Capacitor): the device's back button, the system bars and the screen's orientation, and
 * picture in picture when leaving the app during a video (the `LumioPip` plugin in android/app, MainActivity.java).
 */
export const inCapacitor = () => Capacitor.isNativePlatform()

export function onCapacitorBack(handler: () => void) {
  void App.addListener('backButton', handler)
}

/** Leaving from the start page: to the background, so music plays on (as media apps do). */
export const minimizeCapacitorApp = () => void App.minimizeApp()

/** The video player: no system bars (swiped in, they hide again by themselves), turned to landscape; and back. */
export async function setCapacitorFullscreen(on: boolean) {
  try {
    await SystemControls.setImmersive({ on })
    if (on) await ScreenOrientation.lock({ orientation: 'landscape' })
    else await ScreenOrientation.unlock()
  } catch {
    // An older WebView or a device without these: the player still works.
  }
}

interface PipPlugin {
  /** While a video plays: leaving the app shrinks it into a floating window of this shape (0 = don't). */
  setAutoEnter(options: { enabled: boolean; width: number; height: number; playing: boolean }): Promise<void>
}

const Pip = registerPlugin<PipPlugin>('LumioPip')

export function setAutoPip(enabled: boolean, width: number, height: number, playing: boolean) {
  if (!inCapacitor()) return
  void Pip.setAutoEnter({ enabled, width, height, playing }).catch(() => undefined)
}

/**
 * The floating window: whether the app is in it (the player then shows only the picture), and its buttons
 * (`playpause`, `back`, `forward`).
 */
export function onPipEvents(onMode: (inPip: boolean) => void, onAction: (action: string) => void) {
  const mode = (event: Event) => onMode(!!(event as Event & { inPip?: boolean }).inPip)
  const action = (event: Event) => onAction(String((event as Event & { action?: string }).action ?? ''))
  window.addEventListener('lumiopip', mode)
  window.addEventListener('lumiopipaction', action)
  return () => {
    window.removeEventListener('lumiopip', mode)
    window.removeEventListener('lumiopipaction', action)
  }
}

interface SystemControlsPlugin {
  getVolume(): Promise<{ value: number }>
  setVolume(options: { value: number }): Promise<void>
  getBrightness(): Promise<{ value: number }>
  setBrightness(options: { value: number }): Promise<void>
  resetBrightness(): Promise<void>
  setImmersive(options: { on: boolean }): Promise<void>
}

/** The device's media volume and the brightness of Lumio's window, 0..1 (the video player's swipe gestures). */
export const SystemControls = registerPlugin<SystemControlsPlugin>('LumioSystemControls')
