import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { persistQueryCache, restoreQueryCache, RESTORE_TIMEOUT_MS } from './lib/query-persist'
import { queryClient } from './lib/query-client'
import { initTheme } from './lib/theme'

initTheme()

// The data from last time comes back first (briefly, never holding the start up for long), then the app renders and
// refreshes it in the background.
void Promise.race([restoreQueryCache(queryClient), new Promise((resolve) => setTimeout(resolve, RESTORE_TIMEOUT_MS))]).then(() => {
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
