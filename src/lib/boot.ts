/**
 * The boot screen (in index.html) covers the page until the first view has its content, so nobody watches the page
 * assemble itself. Each entry page calls `markAppReady` once it is ready; a timeout makes sure the screen never stays.
 */
const MAX_BOOT_MS = 5000
/** Where index.html finds the server's branding before the app has loaded. */
export const BRAND_CACHE_KEY = 'lumio.brand'

let ready = false

export function markAppReady() {
  if (ready) return
  ready = true
  const screen = document.getElementById('boot')
  if (!screen) return
  screen.dataset.state = 'hidden'
  window.setTimeout(() => screen.remove(), 400)
}

if (typeof window !== 'undefined') window.setTimeout(markAppReady, MAX_BOOT_MS)

/** Remembers the branding for the next start's boot screen (name, logo, favicon, accent). */
export function cacheBrand(brand: { appName?: string; logo?: string; logoLight?: string; favicon?: string; faviconLight?: string; primaryColor?: string }) {
  try {
    localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(brand))
  } catch {
    // Storage full or blocked: the next start just shows the default brand.
  }
}
