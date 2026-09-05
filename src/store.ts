import { create } from 'zustand'
import { CITY_BY_ID, cityForTimezone } from './lib/search'
import { isValidTimeZone } from './lib/time'
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
  baseCityId: string | null
  displayMode: DisplayMode
  pinned: string[]
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const fields = parsed as Record<string, unknown>
    const result: Partial<Persisted> = {}
    if (typeof fields.baseTimezone === 'string' && isValidTimeZone(fields.baseTimezone)) {
      result.baseTimezone = fields.baseTimezone
    }
    if (typeof fields.baseCityId === 'string') result.baseCityId = fields.baseCityId
    if (fields.displayMode === 'iana' || fields.displayMode === 'utc' || fields.displayMode === 'abbreviation') {
      result.displayMode = fields.displayMode
    }
    if (Array.isArray(fields.pinned)) {
      result.pinned = [...new Set(fields.pinned.filter((id): id is string => typeof id === 'string' && CITY_BY_ID.has(id)))]
    }
    return result
  } catch {
    return {}
  }
}

interface State {
  baseTimezone: string
  /** city id if the base is one of our cities */
  baseCityId: string | null
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
      baseCityId: s.baseCityId,
      displayMode: s.displayMode,
      pinned: s.pinned,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage unavailable (private mode) — non-fatal
  }
}

export const useStore = create<State>((set, get) => ({
  baseTimezone: persisted.baseTimezone ?? 'Asia/Shanghai',
  baseCityId: cityForTimezone(persisted.baseTimezone ?? 'Asia/Shanghai', persisted.baseCityId)?.id ?? null,
  selectedTimezone: null,
  selectedCityId: null,
  clickPosition: null,
  displayMode: persisted.displayMode ?? 'iana',
  mode: 'now',
  customDateTime: null,
  regionFilter: 'all',
  pinned: persisted.pinned ?? DEFAULT_PINNED,
  layers: { timezones: true, countries: true, cities: true },
  countryPicker: null,
  searchOpen: false,

  setBase: (timezone, cityId = null) => {
    if (!isValidTimeZone(timezone)) return
    set({ baseTimezone: timezone, baseCityId: cityForTimezone(timezone, cityId)?.id ?? null,
      selectedTimezone: null, selectedCityId: null, clickPosition: null })
    persist(get())
  },
  select: (timezone, cityId = null, clickPos = null) => {
    if (timezone && !isValidTimeZone(timezone)) return
    set({ selectedTimezone: timezone,
      selectedCityId: timezone ? cityForTimezone(timezone, cityId)?.id ?? null : null,
      clickPosition: timezone ? clickPos : null })
  },
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
    if (!CITY_BY_ID.has(cityId)) return
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
