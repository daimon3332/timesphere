import type { Map as MlMap } from 'maplibre-gl'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CITIES } from '../data/cities'
import type { City } from '../types'

interface Props {
  map: MlMap | null
  ready: boolean
  baseCityId: string | null
  selectedCityId: string | null
  visible: boolean
  onSelect: (timezone: string, cityId: string) => void
}

/** Tier reveal thresholds (§22). */
function maxTier(zoom: number): number {
  if (zoom < 2.2) return 1
  if (zoom < 3.6) return 2
  return 3
}

const LABEL_W = 52
const LABEL_H = 17

type Point = { x: number; y: number }

/**
 * Visibility is decided purely from projected screen position, across world
 * copies: `bounds.contains` disagrees with `project` once the centre passes
 * ±180°. Testing lng ±360 finds whichever copy is on screen.
 */
function screenPoint(map: MlMap, c: City, w: number, h: number): Point | null {
  let best: Point | null = null
  for (const shift of [0, -360, 360]) {
    const p = map.project([c.longitude + shift, c.latitude])
    if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue
    if (!best || Math.abs(p.x - w / 2) < Math.abs(best.x - w / 2)) best = { x: p.x, y: p.y }
  }
  return best
}

/**
 * City dots + labels as DOM instead of a MapLibre symbol layer: no remote
 * glyph server for CJK, and real font control. Collision is resolved greedily
 * in priority order, so a tier-1 city never loses its label to a neighbour.
 *
 * Which cities show is React state; where they sit is written straight to the
 * DOM inside MapLibre's `move` event, i.e. in the same frame the canvas is
 * drawn. Routing positions through state or a deferred rAF left the dots
 * frozen for the whole of an easeTo and then snapping into place.
 */
export const CityLabels = memo(function CityLabels({
  map,
  ready,
  baseCityId,
  selectedCityId,
  visible,
  onSelect,
}: Props) {
  const [placed, setPlaced] = useState<City[]>([])
  const nodes = useRef(new Map<string, HTMLButtonElement>())
  const points = useRef(new Map<string, Point>())

  const apply = useCallback(() => {
    for (const [id, el] of nodes.current) {
      const p = points.current.get(id)
      if (p) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    }
  }, [])

  useEffect(() => {
    if (!map || !ready) return

    const layout = () => {
      const tier = maxTier(map.getZoom())
      const canvas = map.getCanvas()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const rank = (c: City) => (c.id === baseCityId ? -2 : c.id === selectedCityId ? -1 : c.priority)
      const candidates = CITIES.filter(
        (c) => c.priority <= tier || c.id === baseCityId || c.id === selectedCityId,
      ).sort((a, b) => rank(a) - rank(b))

      const next = new Map<string, Point>()
      const out: City[] = []
      for (const c of candidates) {
        const p = screenPoint(map, c, w, h)
        if (!p) continue
        let clash = false
        for (const t of next.values()) {
          if (Math.abs(t.x - p.x) < LABEL_W && Math.abs(t.y - p.y) < LABEL_H) {
            clash = true
            break
          }
        }
        if (clash) continue
        next.set(c.id, p)
        out.push(c)
      }
      points.current = next
      apply()
      setPlaced((prev) =>
        prev.length === out.length && prev.every((c, i) => c === out[i]) ? prev : out,
      )
    }

    layout()
    map.on('move', layout)
    map.on('resize', layout)
    return () => {
      map.off('move', layout)
      map.off('resize', layout)
    }
  }, [map, ready, baseCityId, selectedCityId, apply])

  // Newly mounted nodes (and any re-render) pick up the latest positions
  // before paint.
  useLayoutEffect(() => apply())

  if (!visible) return null

  return (
    <div className="city-labels">
      {placed.map((city) => {
        const isBase = city.id === baseCityId
        const isSel = city.id === selectedCityId
        const key = isSel ? `${city.id}:sel` : city.id
        return (
          <button
            // Selection is part of the key so the flash animation replays
            // each time a new city is picked.
            key={key}
            ref={(el) => {
              if (!el) return
              nodes.current.set(city.id, el)
              return () => {
                if (nodes.current.get(city.id) === el) nodes.current.delete(city.id)
              }
            }}
            className={`cl${isBase ? ' is-base' : ''}${isSel ? ' is-sel' : ''}${
              city.priority === 1 ? ' is-major' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(city.timezone, city.id)
            }}
            title={`${city.nameZh} · ${city.timezone}`}
          >
            <span className="cl-dot" />
            <span className="cl-text">{city.nameZh}</span>
          </button>
        )
      })}
    </div>
  )
})
