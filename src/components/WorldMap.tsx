import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CITIES } from '../data/cities'
import { NUMERIC_TO_ALPHA2, COUNTRY_BY_CODE } from '../data/countries'
import {
  EMPTY_STYLE,
  LYR_CITY_DOT,
  LYR_CITY_PIN,
  LYR_COUNTRY_FILL,
  LYR_COUNTRY_HOVER,
  LYR_COUNTRY_LINE,
  LYR_GRID_LINE,
  LYR_LAND_FILL,
  LYR_TZ_FILL,
  LYR_TZ_LINE,
  LYR_TZ_SELECTED,
  SRC_CITY,
  SRC_COUNTRY,
  SRC_GRID,
  SRC_TZ,
  meridianGrid,
  offsetColor,
} from '../lib/map-style'
import { CITY_BY_ZONE, isNauticalZone, nauticalZoneAt, zoneLabel } from '../lib/search'
import { describeZone, formatDifference, offsetMinutes } from '../lib/time'
import { useStore } from '../store'
import { CityLabels } from './CityLabels'
import { MapTooltip, type TooltipData } from './MapTooltip'
import { UtcRuler } from './UtcRuler'

interface Props {
  now: Date
  onSelect: (timezone: string, cityId?: string | null, clickPos?: { x: number; y: number } | null) => void
}

export const WorldMap = memo(function WorldMap({ now, onSelect }: Props) {
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Mirrored in state so DOM-overlay children re-render once the map exists.
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [zoom, setZoom] = useState(1.1)

  const baseTimezone = useStore((s) => s.baseTimezone)
  const selectedTimezone = useStore((s) => s.selectedTimezone)
  const layers = useStore((s) => s.layers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const openCountryPicker = useStore((s) => s.openCountryPicker)

  // Keep the latest instant/base available to map event handlers without
  // re-binding them every second.
  const liveRef = useRef({ now, baseTimezone })
  liveRef.current = { now, baseTimezone }

  // Explicit numeric feature ids so setFeatureState never depends on
  // MapLibre's id-generation order.
  const cityGeo = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: CITIES.map((c, i) => ({
        type: 'Feature',
        id: i,
        properties: {
          id: c.id,
          nameZh: c.nameZh,
          timezone: c.timezone,
          priority: c.priority,
        },
        geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
      })),
    }),
    [],
  )

  /** Our own handle on the tz GeoJSON — never read MapLibre's private _data. */
  const tzDataRef = useRef<GeoJSON.FeatureCollection | null>(null)

  // ---------------------------------------------------------------- init map
  useEffect(() => {
    if (!holder.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: holder.current,
      style: EMPTY_STYLE,
      center: [20, 26],
      zoom: 1.1,
      minZoom: 0.6,
      maxZoom: 9,
      renderWorldCopies: true,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    })
    mapRef.current = map
    setMapInstance(map)
    map.touchZoomRotate.disableRotation()
    map.keyboard.enable()

    let cancelled = false

    const boot = async () => {
      try {
        /**
         * A missing static file is often answered with the SPA's index.html
         * rather than a 404, so a bare res.json() would surface
         * "Unexpected token '<'". Check the payload shape and report the
         * file that is actually missing.
         */
        const loadGeo = async (file: string): Promise<GeoJSON.FeatureCollection> => {
          const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
          if (!res.ok) throw new Error(`${file} 请求失败（HTTP ${res.status}）`)
          const text = await res.text()
          if (!text.startsWith('{')) throw new Error(`${file} 内容不是有效的地图数据`)
          const parsed = JSON.parse(text) as GeoJSON.FeatureCollection
          if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
            throw new Error(`${file} 缺少地理要素`)
          }
          return parsed
        }
        const [tzGeo, countryGeo] = await Promise.all([
          loadGeo('timezones.json'),
          loadGeo('countries.json'),
        ])
        if (cancelled) return

        await new Promise<void>((resolve) => {
          if (map.isStyleLoaded()) resolve()
          else map.once('load', () => resolve())
        })
        if (cancelled) return

        // Stamp each zone with its current offset so fill colour is a data
        // lookup rather than a 443-branch expression.
        stampOffsets(tzGeo, liveRef.current.now)
        tzDataRef.current = tzGeo

        map.addSource(SRC_TZ, { type: 'geojson', data: tzGeo, promoteId: 'tzid' })
        // No generateId: the source already carries numeric ISO ids ("840"),
        // and generating ids would destroy the country lookup.
        map.addSource(SRC_COUNTRY, { type: 'geojson', data: countryGeo })
        map.addSource(SRC_CITY, { type: 'geojson', data: cityGeo })
        map.addSource(SRC_GRID, { type: 'geojson', data: meridianGrid() })

        /**
         * The background is ocean. Land comes from the country polygons, so
         * every continent has a silhouette even before timezone colour is
         * applied — and any territory the tz data misses still looks like land.
         */
        map.addLayer({
          id: LYR_LAND_FILL,
          type: 'fill',
          source: SRC_COUNTRY,
          paint: { 'fill-color': '#e9eef4', 'fill-opacity': 1 },
        })
        /**
         * Timezone bands. The source is land-clipped, so these tint the
         * continents and leave the sea alone. Filling the ocean with the same
         * palette is what made the map read as a flat pastel grid.
         */
        map.addLayer({
          id: LYR_TZ_FILL,
          type: 'fill',
          source: SRC_TZ,
          paint: {
            'fill-color': ['coalesce', ['get', 'color'], '#dfe6ef'],
            'fill-opacity': 0.95,
          },
        })
        map.addLayer({
          id: LYR_TZ_LINE,
          type: 'line',
          source: SRC_TZ,
          paint: {
            'line-color': '#4d637d',
            'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 5, 1.2],
            'line-opacity': 0.5,
            'line-dasharray': [2, 2],
          },
        })
        map.addLayer({
          id: LYR_GRID_LINE,
          type: 'line',
          source: SRC_GRID,
          paint: {
            'line-color': '#8fa4bd',
            'line-width': 0.5,
            'line-opacity': 0.28,
            'line-dasharray': [3, 3],
          },
        })
        // Invisible but queryable: keeps country hit-testing alive when the
        // country layer is toggled off.
        map.addLayer({
          id: LYR_COUNTRY_FILL,
          type: 'fill',
          source: SRC_COUNTRY,
          paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.001 },
        })
        map.addLayer({
          id: LYR_COUNTRY_HOVER,
          type: 'fill',
          source: SRC_COUNTRY,
          paint: {
            'fill-color': '#2563eb',
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              0.13,
              0,
            ],
          },
        })
        /**
         * Coast/border stroke. Must be at least ~1px at the default zoom: at
         * 0.5px on a 2.6x-DPR canvas it rasterises sub-pixel and alpha-blends
         * into the fill, which is why no borders were visible at all.
         */
        map.addLayer({
          id: LYR_COUNTRY_LINE,
          type: 'line',
          source: SRC_COUNTRY,
          paint: {
            'line-color': '#3d5570',
            'line-width': ['interpolate', ['linear'], ['zoom'], 0.6, 1, 2, 1.3, 5, 2.2],
            'line-opacity': 1,
          },
        })
        map.addLayer({
          id: LYR_TZ_SELECTED,
          type: 'line',
          source: SRC_TZ,
          paint: {
            'line-color': '#2563eb',
            'line-width': 2,
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              1,
              0,
            ],
          },
        })
        // Transparent but queryable: gives cursor hit-testing a generous
        // target while the visible dots are DOM (see CityLabels).
        map.addLayer({
          id: LYR_CITY_DOT,
          type: 'circle',
          source: SRC_CITY,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 8],
            'circle-color': '#5b7ca6',
            'circle-opacity': 0,
          },
        })
        map.addLayer({
          id: LYR_CITY_PIN,
          type: 'circle',
          source: SRC_CITY,
          paint: {
            'circle-radius': 7,
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'base'], false],
              '#e8464f',
              ['boolean', ['feature-state', 'selected'], false],
              '#2563eb',
              'rgba(0,0,0,0)',
            ],
            'circle-stroke-width': [
              'case',
              [
                'any',
                ['boolean', ['feature-state', 'base'], false],
                ['boolean', ['feature-state', 'selected'], false],
              ],
              2.5,
              0,
            ],
            'circle-stroke-color': '#ffffff',
          },
        })

        if (cancelled) return
        if (import.meta.env.DEV) {
          ;(window as unknown as { __map?: maplibregl.Map }).__map = map
        }
        setReady(true)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '地图数据加载失败')
        }
      }
    }
    void boot()

    const onZoom = () => setZoom(map.getZoom())
    map.on('zoom', onZoom)

    return () => {
      cancelled = true
      map.off('zoom', onZoom)
      map.remove()
      mapRef.current = null
      setMapInstance(null)
      setReady(false)
    }
  }, [cityGeo])

  // -------------------------------------------------- offsets follow the hour
  // DST transitions land on hour boundaries, so recolouring hourly is enough
  // and avoids re-serialising 3 MB of GeoJSON every second.
  const hourKey = useMemo(
    () => `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`,
    [now],
  )
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource(SRC_TZ) as GeoJSONSource | undefined
    const data = tzDataRef.current
    if (!src || !data) return
    // Instant comes from the ref, so this effect depends only on the hour.
    // Re-serialising 3 MB of GeoJSON every second would be wasteful, and zone
    // offsets can only change on an hour boundary.
    stampOffsets(data, liveRef.current.now)
    src.setData(data)
  }, [hourKey, ready])

  // ------------------------------------------------------- interaction wiring
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    let hoveredCountry: string | number | undefined
    const clearCountryHover = () => {
      if (hoveredCountry !== undefined) {
        map.setFeatureState({ source: SRC_COUNTRY, id: hoveredCountry }, { hover: false })
        hoveredCountry = undefined
      }
    }

    const cityAt = (e: maplibregl.MapMouseEvent) =>
      map
        .queryRenderedFeatures(
          [
            [e.point.x - 8, e.point.y - 8],
            [e.point.x + 8, e.point.y + 8],
          ],
          { layers: [LYR_CITY_DOT] },
        )
        .at(0)

    const onMove = (e: maplibregl.MapMouseEvent) => {
      const { now: n, baseTimezone: base } = liveRef.current
      const city = cityAt(e)

      if (city) {
        clearCountryHover()
        map.getCanvas().style.cursor = 'pointer'
        const tz = city.properties!.timezone as string
        const info = describeZone(tz, n, base)
        const baseName = CITY_BY_ZONE.get(base)?.nameZh ?? base
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          title: city.properties!.nameZh as string,
          time: info.localTime,
          meta: `${info.abbreviation} · ${info.utcOffset}`,
          diff:
            tz === base ? '当前基准' : `比${baseName}${formatDifference(info.differenceMinutes, baseName)}`,
          dayNote:
            info.dayRelation === 'today'
              ? undefined
              : `${info.shortDate} ${info.weekday}`,
        })
        return
      }

      const country = map
        .queryRenderedFeatures(e.point, { layers: [LYR_COUNTRY_FILL] })
        .at(0)
      if (country) {
        if (hoveredCountry !== country.id) {
          clearCountryHover()
          hoveredCountry = country.id
          map.setFeatureState({ source: SRC_COUNTRY, id: country.id! }, { hover: true })
        }
        const info = countryTooltip(country, n, base)
        map.getCanvas().style.cursor = info ? 'pointer' : ''
        if (info) {
          setTooltip({ ...info, x: e.point.x, y: e.point.y })
          return
        }
      } else {
        clearCountryHover()
      }

      // Fall back to whatever timezone polygon is under the cursor.
      const zone = map.queryRenderedFeatures(e.point, { layers: [LYR_TZ_FILL] }).at(0)
      if (zone) {
        const tz = zone.properties!.tzid as string
        const info = describeZone(tz, n, base)
        const baseName = CITY_BY_ZONE.get(base)?.nameZh ?? base
        map.getCanvas().style.cursor = 'pointer'
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          title: zoneLabel(tz).titleZh,
          time: info.localTime,
          meta: isNauticalZone(tz)
            ? zoneLabel(tz).subtitleZh
            : `${info.abbreviation} · ${info.utcOffset}`,
          diff:
            tz === base
              ? '当前基准'
              : `比${baseName}${formatDifference(info.differenceMinutes, baseName)}`,
          // Etc/GMT ids read backwards (Etc/GMT+9 is UTC-9), so never show them.
          zoneNote: isNauticalZone(tz) ? undefined : tz,
        })
      } else {
        // Open water: nautical band, derived from longitude.
        const tz = nauticalZoneAt(e.lngLat.lng)
        const info = describeZone(tz, n, base)
        const label = zoneLabel(tz)
        const baseName = CITY_BY_ZONE.get(base)?.nameZh ?? base
        map.getCanvas().style.cursor = 'pointer'
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          title: label.titleZh,
          time: info.localTime,
          meta: label.subtitleZh,
          diff:
            tz === base
              ? '当前基准'
              : `比${baseName}${formatDifference(info.differenceMinutes, baseName)}`,
        })
      }
    }

    const onLeave = () => {
      clearCountryHover()
      setTooltip(null)
      map.getCanvas().style.cursor = ''
    }

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const city = cityAt(e)
      if (city) {
        onSelect(city.properties!.timezone as string, city.properties!.id as string, { x: e.point.x, y: e.point.y })
        return
      }
      const country = map.queryRenderedFeatures(e.point, { layers: [LYR_COUNTRY_FILL] }).at(0)
      if (country) {
        const code = alpha2Of(country)
        const info = code ? COUNTRY_BY_CODE.get(code) : undefined
        if (info && info.zones.length > 1) {
          // §26: multi-timezone country must ask, never assume.
          openCountryPicker(code!, [e.lngLat.lng, e.lngLat.lat])
          return
        }
        if (info && info.zones.length === 1) {
          const z = info.zones[0]!
          onSelect(z.timezone, z.cityId ?? null, { x: e.point.x, y: e.point.y })
          return
        }
      }
      const zone = map.queryRenderedFeatures(e.point, { layers: [LYR_TZ_FILL] }).at(0)
      if (zone) {
        const tz = zone.properties!.tzid as string
        onSelect(tz, CITY_BY_ZONE.get(tz)?.id ?? null, { x: e.point.x, y: e.point.y })
        return
      }
      // Open water: answer from the nautical meridian bands.
      onSelect(nauticalZoneAt(e.lngLat.lng), null, { x: e.point.x, y: e.point.y })
    }

    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    map.on('click', onClick)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
      map.off('click', onClick)
    }
  }, [ready, onSelect, openCountryPicker])

  // ------------------------------------------------------------ marker states
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.removeFeatureState({ source: SRC_CITY })
    // One representative city per zone carries the marker, otherwise every
    // city sharing Asia/Shanghai would light up as the base.
    const baseId = CITY_BY_ZONE.get(baseTimezone)?.id
    const selId = selectedTimezone ? CITY_BY_ZONE.get(selectedTimezone)?.id : undefined
    CITIES.forEach((c, i) => {
      map.setFeatureState(
        { source: SRC_CITY, id: i },
        { base: c.id === baseId, selected: c.id === selId },
      )
    })
  }, [ready, baseTimezone, selectedTimezone])

  // Highlight the selected timezone polygon.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.removeFeatureState({ source: SRC_TZ })
    if (selectedTimezone) {
      map.setFeatureState({ source: SRC_TZ, id: selectedTimezone }, { selected: true })
    }
  }, [ready, selectedTimezone])

  // ------------------------------------------------------------ layer toggles
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const set = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
    // TZ fill stays rendered (transparent) so clicks still resolve a zone.
    if (map.getLayer(LYR_TZ_FILL)) {
      map.setPaintProperty(LYR_TZ_FILL, 'fill-opacity', layers.timezones ? 1 : 0)
    }
    set(LYR_TZ_LINE, layers.timezones)
    set(LYR_GRID_LINE, layers.timezones)
    set(LYR_COUNTRY_LINE, layers.countries)
    set(LYR_COUNTRY_HOVER, layers.countries)
    set(LYR_CITY_DOT, layers.cities)
    set(LYR_CITY_PIN, layers.cities)
  }, [ready, layers])

  // ------------------------------------------------------------ fly to select
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selectedTimezone) return
    const city = CITY_BY_ZONE.get(selectedTimezone)
    if (!city) return
    map.easeTo({
      center: [city.longitude, city.latitude],
      zoom: Math.max(map.getZoom(), 2.6),
      duration: 700,
    })
  }, [ready, selectedTimezone])

  const home = useCallback(() => {
    mapRef.current?.easeTo({ center: [20, 26], zoom: 1.1, duration: 600 })
  }, [])

  const gotoBase = useCallback(() => {
    const city = CITY_BY_ZONE.get(baseTimezone)
    if (!city) return
    mapRef.current?.easeTo({
      center: [city.longitude, city.latitude],
      zoom: 3,
      duration: 700,
    })
  }, [baseTimezone])

  const baseCity = CITY_BY_ZONE.get(baseTimezone)
  const selectedCity = selectedTimezone ? CITY_BY_ZONE.get(selectedTimezone) : undefined

  return (
    <div className="map-wrap">
      <div className="map-holder" ref={holder} />
      <CityLabels
        map={mapInstance}
        ready={ready}
        baseTimezone={baseTimezone}
        selectedTimezone={selectedTimezone}
        visible={layers.cities}
        onSelect={onSelect}
      />
      {!ready && !loadError && <div className="map-skeleton" aria-hidden="true" />}
      {loadError && (
        <div className="map-error">
          <p>地图数据加载失败</p>
          <span>{loadError}</span>
          <span className="map-error-hint">城市列表仍可正常使用</span>
        </div>
      )}

      <UtcRuler zoom={zoom} />

      <div className="map-layers" role="group" aria-label="地图图层">
        {(
          [
            ['timezones', '时区'],
            ['countries', '国家'],
            ['cities', '城市'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`layer-btn${layers[key] ? ' is-on' : ''}`}
            aria-pressed={layers[key]}
            onClick={() => toggleLayer(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="map-tools" role="group" aria-label="地图控制">
        <button onClick={() => mapRef.current?.zoomIn({ duration: 220 })} aria-label="放大">
          +
        </button>
        <button onClick={() => mapRef.current?.zoomOut({ duration: 220 })} aria-label="缩小">
          −
        </button>
        <button onClick={home} aria-label="恢复全球视图" title="全球视图">
          ⌖
        </button>
        <button onClick={gotoBase} aria-label="定位基准城市" title="定位基准城市">
          ◎
        </button>
      </div>

      <div className="map-legend">
        <span className="ml-row">
          <i className="dot base" /> 基准 · {baseCity?.nameZh ?? baseTimezone}
        </span>
        <span className="ml-row">
          <i className="dot sel" /> {selectedCity ? `对比 · ${selectedCity.nameZh}` : '点击城市开始对比'}
        </span>
        <span className="ml-row muted">
          <i className="dot other" /> 可点击城市
        </span>
      </div>

      {tooltip && <MapTooltip data={tooltip} />}
    </div>
  )
})

function stampOffsets(geo: GeoJSON.FeatureCollection, instant: Date) {
  for (const f of geo.features) {
    const tzid = (f.properties as { tzid?: string } | null)?.tzid
    if (!tzid) continue
    try {
      const off = offsetMinutes(tzid, instant)
      f.properties!.offset = off
      f.properties!.color = offsetColor(off)
    } catch {
      f.properties!.color = '#e9eef5'
    }
  }
}

function alpha2Of(f: MapGeoJSONFeature): string | undefined {
  const raw = f.properties?.['iso_a2'] ?? f.properties?.['ISO_A2']
  if (typeof raw === 'string' && raw.length === 2) return raw
  // world-atlas carries only the numeric ISO id.
  const numeric = f.id ?? f.properties?.['id']
  if (numeric !== undefined) {
    const key = String(numeric).padStart(3, '0')
    return NUMERIC_TO_ALPHA2[key]
  }
  return undefined
}

function countryTooltip(
  f: MapGeoJSONFeature,
  now: Date,
  base: string,
): Omit<TooltipData, 'x' | 'y'> | null {
  const code = alpha2Of(f)
  const info = code ? COUNTRY_BY_CODE.get(code) : undefined
  const name = (f.properties?.['name'] as string) ?? info?.nameEn ?? ''
  if (!info) return name ? { title: name, meta: '暂无时区数据' } : null

  if (info.zones.length > 1) {
    return {
      title: info.nameZh,
      meta: `${info.zones.length} 个主要时区`,
      diff: '点击选择具体地区',
    }
  }
  const z = info.zones[0]!
  const d = describeZone(z.timezone, now, base)
  const baseName = CITY_BY_ZONE.get(base)?.nameZh ?? base
  return {
    title: info.nameZh,
    time: d.localTime,
    meta: `${d.abbreviation} · ${d.utcOffset}`,
    diff:
      z.timezone === base ? '当前基准' : `比${baseName}${formatDifference(d.differenceMinutes, baseName)}`,
  }
}
