import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocalSettings } from '@/features/settings/local-settings'
import { lumioGet } from '@/features/social/social'
import { getLocale } from '@/lib/i18n'
import { hasService, ownKey } from '@/lib/services'

/**
 * Concerts from Ticketmaster's Discovery API (needs a key: the Lumio server's TICKETMASTER_API_KEY): an artist's upcoming shows, one
 * event with its line-up and venue, and searches by name or around a place. Where "near you" is comes from the
 * browser's location or a city the user picks (looked up with Open-Meteo's free geocoder); it follows the account.
 */
/** Whether concerts can be looked up (the server has a key, or the app was built with one). */
export const concertsAvailable = () => hasService('concerts')

const BASE = 'https://app.ticketmaster.com/discovery/v2'
const DAY = 24 * 60 * 60_000
/** Ticketmaster allows five requests a second; calls are spaced out to stay under it. */
const SPACING_MS = 220
/** "Near you" means within this distance. */
export const NEAR_KM = 100

let nextSlot = 0
/**
 * Asks Ticketmaster, through the Lumio server where it is connected: it caches the answers for everyone (an artist's
 * shows are fetched once every few hours, not by every listener) and spaces out the calls itself.
 */
async function ticketmaster<T>(path: string, params: Record<string, string>): Promise<T> {
  // Searching with one locale (de-de) hides events abroad, so all locales are asked for.
  const key = ownKey('concerts')
  const query = new URLSearchParams({ ...params, ...(key ? { apikey: key } : {}), locale: '*' })
  const relayed = await lumioGet(`/relay/concerts/${path}?${query}`).catch(() => null)
  if (relayed?.ok) return (await relayed.json()) as T
  if (relayed?.status === 404) throw new Error('Ticketmaster 404')
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + SPACING_MS
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
  const response = await fetch(`${BASE}/${path}?${query}`)
  if (!response.ok) throw new Error(`Ticketmaster ${response.status}`)
  return (await response.json()) as T
}

interface TmImage {
  url: string
  ratio?: string
  width?: number
}

interface TmAttraction {
  id: string
  name: string
  images?: TmImage[]
  classifications?: Array<{ genre?: { name?: string } }>
}

interface TmVenue {
  id?: string
  name?: string
  address?: { line1?: string; line2?: string }
  city?: { name?: string }
  postalCode?: string
  country?: { name?: string; countryCode?: string }
  location?: { latitude?: string; longitude?: string }
  url?: string
}

interface TmEvent {
  id: string
  name: string
  url?: string
  info?: string
  pleaseNote?: string
  images?: TmImage[]
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string }; status?: { code?: string }; timezone?: string }
  sales?: { public?: { startDateTime?: string; endDateTime?: string } }
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }> | null
  seatmap?: { staticUrl?: string }
  classifications?: Array<{ genre?: { name?: string } }>
  _embedded?: { venues?: TmVenue[]; attractions?: TmAttraction[] }
}

export interface ConcertArtist {
  id: string
  name: string
  image?: string
  genre?: string
}

export interface Venue {
  name?: string
  address?: string
  postalCode?: string
  city?: string
  country?: string
  countryCode?: string
  lat?: number
  lon?: number
  url?: string
}

export interface Concert {
  id: string
  name: string
  date: string
  time?: string
  /** The start as an instant (UTC), when known; for calendar entries. */
  start?: string
  /** onsale, offsale, cancelled, postponed, rescheduled. */
  status?: string
  url?: string
  image?: string
  venue: Venue
  /** Everyone on the bill, headliner first. */
  artists: ConcertArtist[]
  genre?: string
  info?: string
  pleaseNote?: string
  price?: { min?: number; max?: number; currency?: string }
  /** When ticket sales open, while that is still ahead. */
  presale?: string
  seatmap?: string
}

/** The widest 16:9 picture up to `max` pixels (Ticketmaster offers many sizes). */
function pickImage(images: TmImage[] | undefined, max = 1200) {
  const wide = (images ?? []).filter((image) => image.ratio === '16_9' && (image.width ?? 0) <= max)
  const best = wide.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? images?.[0]
  return best?.url
}

function toConcert(event: TmEvent): Concert {
  const venue = event._embedded?.venues?.[0]
  const lat = Number(venue?.location?.latitude)
  const lon = Number(venue?.location?.longitude)
  const genre = event.classifications?.[0]?.genre?.name
  return {
    id: event.id,
    name: event.name,
    date: event.dates?.start?.localDate ?? '',
    time: event.dates?.start?.localTime,
    start: event.dates?.start?.dateTime,
    status: event.dates?.status?.code,
    url: event.url,
    image: pickImage(event.images),
    venue: {
      name: venue?.name,
      address: [venue?.address?.line1, venue?.address?.line2].filter(Boolean).join(', ') || undefined,
      postalCode: venue?.postalCode,
      city: venue?.city?.name,
      country: venue?.country?.name,
      countryCode: venue?.country?.countryCode,
      lat: Number.isFinite(lat) && lat !== 0 ? lat : undefined,
      lon: Number.isFinite(lon) && lon !== 0 ? lon : undefined,
      url: venue?.url,
    },
    artists: (event._embedded?.attractions ?? []).map((attraction) => ({
      id: attraction.id,
      name: attraction.name,
      image: pickImage(attraction.images, 640),
      genre: attraction.classifications?.[0]?.genre?.name,
    })),
    genre: genre && genre !== 'Undefined' ? genre : undefined,
    info: event.info ?? undefined,
    pleaseNote: event.pleaseNote ?? undefined,
    price: event.priceRanges?.[0] ?? undefined,
    presale: Date.parse(event.sales?.public?.startDateTime ?? '') > Date.now() ? event.sales!.public!.startDateTime : undefined,
    seatmap: event.seatmap?.staticUrl,
  }
}

const upcoming = (events: TmEvent[] | undefined) => (events ?? []).filter((event) => event.dates?.start?.localDate).map(toConcert)

/** Upcoming concerts of an artist, soonest first, worldwide. Matches the artist by exact name only. */
export function useConcerts(name: string | undefined) {
  return useQuery(artistConcertsOptions(name))
}

function artistConcertsOptions(name: string | undefined) {
  return {
    queryKey: ['concerts', name, getLocale()],
    enabled: concertsAvailable() && !!name,
    staleTime: DAY / 4,
    // Kept (also across restarts, see query-persist) for a day after last use.
    gcTime: DAY,
    retry: false,
    queryFn: async (): Promise<Concert[]> => {
      const found = await ticketmaster<{ _embedded?: { attractions?: TmAttraction[] } }>('attractions.json', { keyword: name!, classificationName: 'music' })
      const attraction = found._embedded?.attractions?.find((entry) => entry.name.toLowerCase() === name!.toLowerCase())
      if (!attraction) return []
      const events = await ticketmaster<{ _embedded?: { events?: TmEvent[] } }>('events.json', { attractionId: attraction.id, sort: 'date,asc', size: '30' })
      return upcoming(events._embedded?.events)
    },
  }
}

/** Concerts of several artists at once (those the user follows), soonest first. */
export function useArtistsConcerts(names: string[]) {
  const results = useQueries({ queries: names.map((name) => artistConcertsOptions(name)) })
  const seen = new Set<string>()
  return {
    concerts: results
      .flatMap((result) => result.data ?? [])
      .filter((concert) => !seen.has(concert.id) && !!seen.add(concert.id))
      .sort((a, b) => a.date.localeCompare(b.date)),
    isLoading: results.some((result) => result.isLoading),
  }
}

/** One concert with everything about it. */
export function useConcert(id: string | undefined) {
  return useQuery({
    queryKey: ['concert', id, getLocale()],
    enabled: concertsAvailable() && !!id,
    staleTime: DAY / 4,
    // Kept (also across restarts, see query-persist) for a day after last use.
    gcTime: DAY,
    retry: false,
    queryFn: async () => toConcert(await ticketmaster<TmEvent>(`events/${id}.json`, {})),
  })
}

/** Music events by name (artist, venue, festival) or around a place, soonest first. */
export function useConcertSearch({ keyword, near }: { keyword?: string; near?: ConcertLocation | null }) {
  const term = keyword?.trim() ?? ''
  return useQuery({
    queryKey: ['concert-search', term, near?.lat, near?.lon, getLocale()],
    enabled: concertsAvailable() && (term.length > 1 || !!near),
    staleTime: DAY / 8,
    gcTime: DAY,
    retry: false,
    queryFn: async () => {
      const params: Record<string, string> = { classificationName: 'music', sort: 'date,asc', size: '60' }
      if (term) params.keyword = term
      if (near) Object.assign(params, { geoPoint: geohash(near.lat, near.lon), radius: String(NEAR_KM), unit: 'km' })
      const data = await ticketmaster<{ _embedded?: { events?: TmEvent[] } }>('events.json', params)
      return upcoming(data._embedded?.events)
    },
  })
}

/** Ticketmaster takes locations as geohashes; seven characters is about 150 m, plenty for "near". */
function geohash(lat: number, lon: number, precision = 7) {
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz'
  const range = { lat: [-90, 90], lon: [-180, 180] }
  let hash = ''
  let bits = 0
  let value = 0
  let even = true
  while (hash.length < precision) {
    const [axis, coordinate] = even ? (['lon', lon] as const) : (['lat', lat] as const)
    const middle = (range[axis][0]! + range[axis][1]!) / 2
    value <<= 1
    if (coordinate >= middle) {
      value |= 1
      range[axis][0] = middle
    } else range[axis][1] = middle
    even = !even
    if (++bits === 5) {
      hash += alphabet[value]
      bits = 0
      value = 0
    }
  }
  return hash
}

/** Distance in km between two points (haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat?: number; lon?: number }) {
  if (b.lat === undefined || b.lon === undefined) return undefined
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// ---- where "near you" is ----

export interface ConcertLocation {
  label: string
  lat: number
  lon: number
}

/** Where it was kept before it followed the account (on this device only); taken over once. */
const LEGACY_LOCATION_KEY = 'lumio.listen.concertLocation'

function legacyLocation(): ConcertLocation | null {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_LOCATION_KEY) ?? 'null') as ConcertLocation | null
  } catch {
    return null
  }
}

/** Where concerts are looked for; an account setting, so the same on every device. */
export function useConcertLocation(): ConcertLocation | null {
  const { settings, update } = useLocalSettings()
  // Moves a location chosen before into the account's settings.
  useEffect(() => {
    const legacy = legacyLocation()
    if (!legacy) return
    if (!settings.concertLocation) update({ concertLocation: legacy })
    try {
      localStorage.removeItem(LEGACY_LOCATION_KEY)
    } catch {
      // Taken over again next time.
    }
  }, [settings.concertLocation, update])
  return settings.concertLocation
}

export function useSetConcertLocation() {
  const { update } = useLocalSettings()
  return (next: ConcertLocation | null) => update({ concertLocation: next })
}

/** Places matching a name, for picking the city concerts should be near (Open-Meteo's geocoder, no key). */
export function usePlaceSearch(name: string) {
  return useQuery({
    queryKey: ['places', name.trim(), getLocale()],
    enabled: name.trim().length > 1,
    staleTime: DAY,
    queryFn: async (): Promise<ConcertLocation[]> => {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: name.trim(), count: '6', language: getLocale() })}`)
      if (!response.ok) throw new Error(`Geocoding ${response.status}`)
      const data = (await response.json()) as { results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }> }
      return (data.results ?? []).map((place) => ({
        label: [place.name, place.admin1 !== place.name ? place.admin1 : undefined, place.country].filter(Boolean).join(', '),
        lat: place.latitude,
        lon: place.longitude,
      }))
    },
  })
}
