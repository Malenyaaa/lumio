/**
 * The outside services Lumio can ask (Last.fm, Ticketmaster, TMDb) and with whose key. Normally the Lumio server holds
 * the keys (its LASTFM_API_KEY, TICKETMASTER_API_KEY, TMDB_API_KEY) and the app asks through it; an app built with keys
 * of its own (VITE_…) can also ask the services directly. Without either, the features they bring stay off.
 */
const OWN = {
  lastfm: import.meta.env.VITE_LASTFM_API_KEY?.trim() || undefined,
  concerts: import.meta.env.VITE_TICKETMASTER_API_KEY?.trim() || undefined,
  tmdb: import.meta.env.VITE_TMDB_API_KEY?.trim() || undefined,
}

export type Service = keyof typeof OWN

/** What the Lumio server has keys for (told by /api/public at the start). */
let server: Record<Service, boolean> = { lastfm: false, concerts: false, tmdb: false }

/** Asks the Lumio server which services it has keys for; done once before the app starts (briefly). */
export async function loadServices(base: string) {
  try {
    const response = await fetch(`${base}/public`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return
    const data = (await response.json()) as { services?: Partial<Record<Service, boolean>> }
    server = { ...server, ...data.services }
  } catch {
    // No Lumio server (or offline): only the app's own keys, if any.
  }
}

/** Whether a service can be asked at all. */
export const hasService = (service: Service) => server[service] || !!OWN[service]

/** The app's own key for a service, for asking it directly; undefined when the server's is used (it adds it itself). */
export const ownKey = (service: Service) => OWN[service]
