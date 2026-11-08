import { execSync } from 'node:child_process'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** Which build this is (Settings → About): LUMIO_BUILD from CI (a tag or commit), else the checked-out commit. */
function buildId() {
  const given = process.env.LUMIO_BUILD?.trim()
  if (given) return /^[0-9a-f]{40}$/.test(given) ? given.slice(0, 7) : given
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __LUMIO_BUILD__: JSON.stringify(buildId()) },
  // The Lumio server (server/, run alongside) answers /api; in production it serves the app too.
  server: {
    proxy: { '/api': { target: 'http://localhost:8097', changeOrigin: true } },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
