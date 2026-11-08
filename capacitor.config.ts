import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Lumio for Android: the built pages (dist/, built with VITE_BUNDLED, see `pnpm build:android`) in a WebView, with
 * the device's back button, media notification, landscape video, picture in picture and downloads to the device.
 * The server is the one the user signs in to; its address is https://localhost to the server (allowed there).
 */
const config: CapacitorConfig = {
  appId: 'de.nauren.lumio',
  appName: 'Lumio',
  webDir: 'dist',
  android: {
    // Media keeps playing when the screen goes off or another app comes to the front.
    backgroundColor: '#0a0a0a',
  },
}

export default config
