import type { StyleSpecification } from 'maplibre-gl'

/**
 * UTC offset -> fill colour for land.
 *
 * These are strong enough to read as distinct bands but still let dark
 * borders and labels sit on top (§28). They are applied to *land only* —
 * filling the ocean with the same palette erases the continent silhouette
 * and the map stops looking like a world map at all.
 */
export const OFFSET_COLORS: Record<string, string> = {
  '-12': '#c3d3ea',
  '-11': '#cddcee',
  '-10': '#c2d8ec',
  '-9': '#cfe0ef',
  '-8': '#bcd9e9',
  '-7': '#cae3ee',
  '-6': '#b8dde5',
  '-5': '#c7e6ea',
  '-4': '#bce4e1',
  '-3': '#cbeae4',
  '-2': '#c2e7d6',
  '-1': '#d0ecdd',
  '0': '#d5edcf',
  '1': '#e0f0cd',
  '2': '#ecf0c8',
  '3': '#f3ebc3',
  '4': '#f7e3c2',
  '5': '#f8d9c2',
  '6': '#f8cfc6',
  '7': '#f5c9d0',
  '8': '#eec7dc',
  '9': '#e3c7e5',
  '10': '#d5c8ea',
  '11': '#c9caec',
  '12': '#c1cfec',
  '13': '#bcd6ee',
  '14': '#b8dcee',
}

export function offsetColor(minutes: number): string {
  return OFFSET_COLORS[String(Math.round(minutes / 60))] ?? '#dfe6ef'
}

/** Deep, clearly non-land tone so coastlines read instantly. */
export const OCEAN_COLOR = '#9fc3dd'

/**
 * No `glyphs` entry on purpose: city names are rendered as DOM overlays
 * (see CityLabels), so the map needs no remote font server and works offline.
 */
export const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'bg',
      type: 'background',
      paint: { 'background-color': OCEAN_COLOR },
    },
  ],
}

export const SRC_TZ = 'tz'
export const SRC_COUNTRY = 'country'
export const SRC_CITY = 'city'
export const SRC_GRID = 'grid'

export const LYR_TZ_FILL = 'tz-fill'
export const LYR_LAND_FILL = 'land-fill'
export const LYR_TZ_LINE = 'tz-line'
export const LYR_TZ_HOVER = 'tz-hover'
export const LYR_TZ_SELECTED = 'tz-selected'
export const LYR_COUNTRY_FILL = 'country-fill'
export const LYR_COUNTRY_LINE = 'country-line'
export const LYR_COUNTRY_HOVER = 'country-hover'
export const LYR_GRID_LINE = 'grid-line'
export const LYR_CITY_DOT = 'city-dot'
export const LYR_CITY_PIN = 'city-pin'

/** Meridian lines every 15° as the UTC ruler's visual counterpart (§29). */
export function meridianGrid(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (let h = -11; h <= 12; h++) {
    const lng = h * 15 - 7.5
    if (lng < -180 || lng > 180) continue
    features.push({
      type: 'Feature',
      properties: { hour: h },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng, -85],
          [lng, 85],
        ],
      },
    })
  }
  return { type: 'FeatureCollection', features }
}
