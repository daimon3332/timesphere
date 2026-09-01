import { create } from 'zustand'
import { CITIES } from './data/cities'
import type { ClockMode, DisplayMode, Region } from './types'

export type MapLayer = 'timezones' | 'countries' | 'cities'
export type RegionFilter = Region | 'all' | 'pinned'

const DEFAULT_PINNED = [
  'shanghai', 'beijing', 'hong-kong', 'tokyo', 'seoul', 'singapore',
  'london', 'paris', 'berlin', 'amsterdam', 'madrid', 'rome',
  'zurich', 'frankfurt-am-main', 'stockholm',
  'new-york-city', 'washington', 'boston', 'chicago', 'dallas',
  'los-angeles', 'san-francisco', 'seattle', 'toronto', 'vancouver',
  'dubai', 'riyadh', 'sydney', 'melbourne', 'auckland',
]

const STORAGE_KEY = 'timesphere.v1'

interface Persisted {
  baseTimezone: string
  displayMode: DisplayMode
  pinned: string[]
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<Persisted>
    // Guard against a stale zone id that the platform no longer knows.
    if (parsed.baseTimezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: parsed.baseTimezone })
      } catch {
        delete parsed.baseTimezone
      }
    }
    return parsed
  } catch {
    return {}
  }
}

interface State {
  baseTimezone: string
  /** city id if the base is one of our cities */
  selectedTimezone: string | null
  selectedCityId: string | null
  clickPosition: { x: number; y: number } | null
  displayMode: DisplayMode
  mode: ClockMode
  customDateTime: Date | null
  regionFilter: RegionFilter
  pinned: string[]
  layers: Record<MapLayer, boolean>
  /** country whose zone picker is open, as alpha-2 */
  countryPicker: { code: string; lngLat: [number, number] } | null
  searchOpen: boolean

  setBase: (timezone: string, cityId?: string | null) => void
  select: (timezone: string | null, cityId?: string | null, clickPos?: { x: number; y: number } | null) => void
  setDisplayMode: (m: DisplayMode) => void
  setMode: (m: ClockMode) => void
  setCustomDateTime: (d: Date | null) => void
  setRegionFilter: (r: RegionFilter) => void
  togglePin: (cityId: string) => void
  toggleLayer: (l: MapLayer) => void
  openCountryPicker: (code: string, lngLat: [number, number]) => void
  closeCountryPicker: () => void
  setSearchOpen: (v: boolean) => void
}

const persisted = typeof localStorage === 'undefined' ? {} : loadPersisted()

function persist(s: State) {
  try {
    const data: Persisted = {
      baseTimezone: s.baseTimezone,
      displayMode: s.displayMode,
      pinned: s.pinned,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage unavailable (private mode) — non-fatal
  }
}

const validPinned = (ids: string[]) => {
  const known = new Set(CITIES.map((c) => c.id))
  return ids.filter((id) => known.has(id))
}

export const useStore = create<State>((set, get) => ({
  baseTimezone: persisted.baseTimezone ?? 'Asia/Shanghai',
  selectedTimezone: null,
  selectedCityId: null,
  clickPosition: null,
  displayMode: persisted.displayMode ?? 'iana',
  mode: 'now',
  customDateTime: null,
  regionFilter: 'all',
  pinned: validPinned(persisted.pinned ?? DEFAULT_PINNED),
  layers: { timezones: true, countries: true, cities: true },
  countryPicker: null,
  searchOpen: false,

  setBase: (timezone, cityId = null) => {
    set({ baseTimezone: timezone, selectedTimezone: null, selectedCityId: cityId })
    persist(get())
  },
  select: (timezone, cityId = null, clickPos = null) => set({ selectedTimezone: timezone, selectedCityId: cityId, clickPosition: clickPos }),
  setDisplayMode: (m) => {
    set({ displayMode: m })
    persist(get())
  },
  setMode: (mode) =>
    set((s) => ({
      mode,
      customDateTime:
        mode === 'custom' && !s.customDateTime ? new Date() : s.customDateTime,
    })),
  setCustomDateTime: (d) => set({ customDateTime: d }),
  setRegionFilter: (regionFilter) => set({ regionFilter }),
  togglePin: (cityId) => {
    set((s) => ({
      pinned: s.pinned.includes(cityId)
        ? s.pinned.filter((x) => x !== cityId)
        : [...s.pinned, cityId],
    }))
    persist(get())
  },
  toggleLayer: (l) => set((s) => ({ layers: { ...s.layers, [l]: !s.layers[l] } })),
  openCountryPicker: (code, lngLat) => set({ countryPicker: { code, lngLat } }),
  closeCountryPicker: () => set({ countryPicker: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))

export { DEFAULT_PINNED }
