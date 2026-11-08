import { IconMinus, IconPlus } from '@tabler/icons-react'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { defineMessages, useMessages } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const messages = defineMessages({
  de: { map: (name: string) => `Karte: ${name}`, zoomIn: 'Hineinzoomen', zoomOut: 'Herauszoomen' },
  en: { map: (name: string) => `Map: ${name}`, zoomIn: 'Zoom in', zoomOut: 'Zoom out' },
})

/**
 * Lumio's map theme, in the spirit of Mapbox's dark map: calm greys close to the app's own, navy water, a hint of
 * green for parks, roads a little lighter than the land, and quiet labels. Applied over OpenFreeMap's dark style
 * (free vector tiles of OpenStreetMap, no key), layer by layer.
 */
const LAND = '#1c1c1f'
const THEME: Record<string, Record<string, unknown>> = {
  background: { 'background-color': LAND },
  water: { 'fill-color': '#0f1923' },
  waterway: { 'line-color': '#0f1923' },
  water_name: { 'text-color': '#4d6b84', 'text-halo-color': '#0f1923' },
  landcover_ice_shelf: { 'fill-color': '#202024' },
  landcover_glacier: { 'fill-color': '#202024' },
  landuse_residential: { 'fill-color': '#202023', 'fill-opacity': 0.6 },
  landcover_wood: { 'fill-color': '#1a231e', 'fill-opacity': 0.7 },
  landuse_park: { 'fill-color': '#1a231e' },
  building: { 'fill-color': '#242428', 'fill-outline-color': '#2c2c31' },
  'aeroway-area': { 'fill-color': '#222226' },
  'aeroway-taxiway': { 'line-color': '#2a2a2f' },
  'aeroway-runway-casing': { 'line-color': 'rgba(0,0,0,0)' },
  'aeroway-runway': { 'line-color': '#2e2e33' },
  road_area_pier: { 'fill-color': LAND },
  road_pier: { 'line-color': LAND },
  highway_path: { 'line-color': '#303036' },
  highway_minor: { 'line-color': '#2d2d32' },
  highway_major_casing: { 'line-color': 'rgba(0,0,0,0)' },
  highway_major_inner: { 'line-color': '#3a3a41' },
  highway_major_subtle: { 'line-color': '#333339' },
  highway_motorway_casing: { 'line-color': 'rgba(0,0,0,0)' },
  highway_motorway_inner: { 'line-color': '#46464e' },
  highway_motorway_subtle: { 'line-color': '#3a3a41' },
  railway_transit: { 'line-color': '#2f2f35' },
  railway_transit_dashline: { 'line-color': LAND },
  railway_minor: { 'line-color': '#2f2f35' },
  railway_minor_dashline: { 'line-color': LAND },
  railway: { 'line-color': '#2f2f35' },
  railway_dashline: { 'line-color': LAND },
  highway_name_other: { 'text-color': '#7c7c85', 'text-halo-color': LAND, 'text-halo-width': 1.2 },
  highway_name_motorway: { 'text-color': '#8a8a93' },
  boundary_state: { 'line-color': '#3a3a41' },
  'boundary_country_z0-4': { 'line-color': '#45454d' },
  'boundary_country_z5-': { 'line-color': '#45454d' },
}
const PLACE_LABEL = { 'text-color': '#9d9da6', 'text-halo-color': 'rgba(28,28,31,0.9)', 'text-halo-width': 1.2 }
const CITY_LABEL = { ...PLACE_LABEL, 'text-color': '#d4d4d8' }

let themed: Promise<StyleSpecification> | undefined

/** OpenFreeMap's dark style with Lumio's colours, fetched once. */
function themedStyle() {
  themed ??= fetch('https://tiles.openfreemap.org/styles/dark')
    .then((response) => response.json() as Promise<StyleSpecification>)
    .then((style) => ({
      ...style,
      layers: style.layers.map((layer) => {
        const paint = layer.id.startsWith('place_city') ? CITY_LABEL : layer.id.startsWith('place_') ? PLACE_LABEL : THEME[layer.id]
        if (!paint || !('paint' in layer)) return layer
        const merged: Record<string, unknown> = { ...layer.paint, ...paint }
        // Wood is drawn as a flat tint, not the base style's pattern.
        delete merged['fill-pattern']
        return { ...layer, paint: merged } as typeof layer
      }),
    }))
  themed.catch(() => (themed = undefined))
  return themed
}

/**
 * A venue on a map in Lumio's look (see THEME), with a pin in Listen's green, small zoom buttons and the credits as a
 * quiet label in a corner. The map library is only loaded when a map is shown.
 */
export function VenueMap({ lat, lon, name, className }: { lat: number; lon: number; name: string; className?: string }) {
  const t = useMessages(messages)
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    let cancelled = false
    let created: MapLibreMap | undefined
    void (async () => {
      const [maplibre, style, worker] = await Promise.all([
        import('maplibre-gl'),
        themedStyle(),
        // The library's worker, as its own file: once bundled, the library can't find it next to itself.
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ])
      if (cancelled || !container.current) return
      maplibre.setWorkerUrl(new URL(worker.default, window.location.href).href)
      created = new maplibre.Map({
        container: container.current,
        style,
        center: [lon, lat],
        zoom: 15,
        attributionControl: false,
        // The page scrolls with the wheel; the map zooms with its buttons, a double-click or a pinch.
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      })
      created.touchZoomRotate.disableRotation()
      const pin = document.createElement('div')
      pin.className = 'lumio-map-pin'
      new maplibre.Marker({ element: pin }).setLngLat([lon, lat]).addTo(created)
      map.current = created
    })().catch(() => undefined)
    return () => {
      cancelled = true
      created?.remove()
      map.current = null
    }
  }, [lat, lon])

  return (
    <div role="img" aria-label={t.map(name)} className={cn('relative overflow-hidden', className)} style={{ background: LAND }}>
      {/* MapLibre makes its container position: relative, so the container fills a positioned wrapper instead. */}
      <div className="absolute inset-0">
        <div ref={container} className="size-full" />
      </div>
      {/* A soft vignette so the map's edges melt into the card. */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgb(0_0_0/0.5)]" />

      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg bg-background/80 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
        <button type="button" aria-label={t.zoomIn} onClick={() => map.current?.zoomIn()} className="grid size-8 place-items-center text-foreground/80 hover:bg-foreground/10 hover:text-foreground">
          <IconPlus className="size-4" />
        </button>
        <span className="h-px bg-foreground/10" />
        <button type="button" aria-label={t.zoomOut} onClick={() => map.current?.zoomOut()} className="grid size-8 place-items-center text-foreground/80 hover:bg-foreground/10 hover:text-foreground">
          <IconMinus className="size-4" />
        </button>
      </div>

      {/* The credits OpenFreeMap asks for, kept small in a corner. */}
      <p className="absolute bottom-1.5 right-1.5 rounded bg-background/70 px-1.5 py-0.5 text-[10px] leading-tight text-foreground/50 backdrop-blur">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer noopener" className="hover:text-foreground hover:underline">
          OpenFreeMap
        </a>{' '}
        ©{' '}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer noopener" className="hover:text-foreground hover:underline">
          OpenMapTiles
        </a>{' '}
        ·{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener" className="hover:text-foreground hover:underline">
          OpenStreetMap
        </a>
      </p>
    </div>
  )
}
