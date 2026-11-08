/**
 * Jellyfin's official Android app, which shows the server's web client (here Lumio) in a WebView. It adds
 * `window.NativeInterface` before the page loads; its own screens (app settings, server and account selection) are
 * reached through it.
 */
interface NativeInterface {
  openClientSettings(): void
  openServerSelection(): void
}

const native = () => (typeof window === 'undefined' ? undefined : (window as { NativeInterface?: NativeInterface }).NativeInterface)

export const inJellyfinApp = () => !!native()

export const openAppSettings = () => native()?.openClientSettings()

export const openServerSelection = () => native()?.openServerSelection()
