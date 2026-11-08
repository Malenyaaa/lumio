import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Lumio for Android: the built pages (dist/, built with VITE_BUNDLED, see `pnpm build:android`) in a WebView, with
 * the device's back button, media notification, landscape video, picture in picture and downloads to the device.
 * The server is the one the user signs in to; its address is https://localhost to the server (allowed there).
 */
const config: CapacitorConfig = {
  appId: 'de.lumio',
  appName: 'Lumio',
  webDir: 'dist',
  android: {
    backgroundColor: '#0a0a0a',
    // Servers at home are often plain http (the sign-in tries https first, then http): the pages, served as
    // https://localhost, may reach them.
    allowMixedContent: true,
  },
}

export default config
