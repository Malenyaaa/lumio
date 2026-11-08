import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { persistQueryCache, restoreQueryCache, RESTORE_TIMEOUT_MS } from './lib/query-persist'
import { queryClient } from './lib/query-client'
import { initTheme } from './lib/theme'
import { loadServices } from './lib/services'
import { installOfflineLibrary } from './features/listen/offline-library'
import { initPersistentStorage } from './lib/persistent-storage'

initTheme()
// Downloads and the offline library need the browser to keep the site's storage: checked and asked for at once.
initPersistentStorage()
// Without a network, Jellyfin's answers come from the downloads (see offline-library).
installOfflineLibrary()

// The data from last time comes back first (briefly, never holding the start up for long), then the app renders and
// refreshes it in the background.
const servicesBase = (import.meta.env.VITE_SOCIAL_URL?.trim() || '/api').replace(/\/+$/, '')
void Promise.all([
  Promise.race([restoreQueryCache(queryClient), new Promise((resolve) => setTimeout(resolve, RESTORE_TIMEOUT_MS))]),
  // Which outside services the Lumio server has keys for (Last.fm, Ticketmaster, TMDb).
  Promise.race([loadServices(servicesBase), new Promise((resolve) => setTimeout(resolve, 1500))]),
]).then(() => {
  persistQueryCache(queryClient)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

// The built app keeps itself in the browser (public/sw.js); not in development, where it would fight hot reloading.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
