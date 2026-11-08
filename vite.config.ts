import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
