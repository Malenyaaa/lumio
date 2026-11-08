/// <reference types="vite/client" />

/** Deployment settings read from `.env` (documented in `.env.example`). */
interface ImportMetaEnv {
  readonly VITE_JELLYFIN_URL?: string
  readonly VITE_TMDB_API_KEY?: string
  readonly VITE_PASSWORD_CHANGE_DISABLED?: string
  readonly VITE_ACCOUNT_URL?: string
  readonly VITE_SERVER_LOCKED?: string
  readonly VITE_LASTFM_API_KEY?: string
  readonly VITE_TICKETMASTER_API_KEY?: string
  readonly VITE_SOCIAL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
