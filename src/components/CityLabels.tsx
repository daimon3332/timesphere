import type { Map as MlMap } from 'maplibre-gl'
import { memo, useEffect, useState } from 'react'
import { CITIES } from '../data/cities'
import type { City } from '../types'

interface Placed {
  city: City
  x: number
  y: number
}

interface Props {
  map: MlMap | null
  ready: boolean
  baseCityId: string | null
  selectedCityId: string | null
  visible: boolean
  onSelect: (timezone: string, cityId: string, clickPosition?: { x: number; y: number }) => void
}

/** Tier reveal thresholds (§22). */
function maxTier(zoom: number): number {
  if (zoom < 2.2) return 1
  if (zoom < 3.6) return 2
  return 3
}

const LABEL_W = 52
const LABEL_H = 17

/**
 * City dots + labels as DOM instead of a MapLibre symbol layer. Avoids
 * depending on a remote glyph server for CJK, and gives real font control.
 * Collision is resolved greedily in priority order, so a tier-1 city never
 * loses its label to a smaller neighbour.
 */
export const CityLabels = memo(function CityLabels({
  map,
  ready,
  baseCityId,
  selectedCityId,
  visible,
  onSelect,
}: Props) {
  const [placed, setPlaced] = useState<Placed[]>([])

  useEffect(() => {
    if (!map || !ready) return

    let raf = 0
    const recompute = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const zoom = map.getZoom()
        const tier = maxTier(zoom)
        const canvas = map.getCanvas()
        const w = canvas.clientWidth
        const h = canvas.clientHeight

        const candidates = CITIES.filter((c) => {
          if (c.priority > tier) return c.id === baseCityId || c.id === selectedCityId
          return true
        }).sort((a, b) => {
          const key = (c: City) => (c.id === baseCityId ? -2 : c.id === selectedCityId ? -1 : c.priority)
          return key(a) - key(b)
        })

        const taken: { x: number; y: number }[] = []
        const out: Placed[] = []
        for (const c of candidates) {
          /**
           * Visibility is decided purely from projected screen position, and
           * across world copies. `bounds.contains` disagrees with `project`
           * once the centre passes ±180° (renderWorldCopies is on), which made
           * labels vanish or show the wrong continent after dragging far east
           * or west. Testing lng ±360 finds whichever copy is on screen.
           */
          let best: { x: number; y: number } | null = null
          for (const shift of [0, -360, 360]) {
            const p = map.project([c.longitude + shift, c.latitude])
            if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue
            if (!best || Math.abs(p.x - w / 2) < Math.abs(best.x - w / 2)) {
              best = { x: p.x, y: p.y }
            }
          }
          if (!best) continue
          const clash = taken.some(
            (t) => Math.abs(t.x - best!.x) < LABEL_W && Math.abs(t.y - best!.y) < LABEL_H,
          )
          if (clash) continue
          taken.push(best)
          out.push({ city: c, x: best.x, y: best.y })
        }
        setPlaced(out)
      })
    }

    recompute()
    map.on('move', recompute)
    map.on('zoom', recompute)
    map.on('resize', recompute)
    return () => {
      cancelAnimationFrame(raf)
      map.off('move', recompute)
      map.off('zoom', recompute)
      map.off('resize', recompute)
    }
  }, [map, ready, baseCityId, selectedCityId])

  if (!visible) return null

  return (
    <div className="city-labels">
      {placed.map(({ city, x, y }) => {
        const isBase = city.id === baseCityId
        const isSel = city.id === selectedCityId
        return (
          <button
            // Selection is part of the key so the flash animation replays
            // each time a new city is picked (React would otherwise reuse
            // the node and the keyframes would not restart).
            key={isSel ? `${city.id}:sel` : city.id}
            className={`cl${isBase ? ' is-base' : ''}${isSel ? ' is-sel' : ''}${
              city.priority === 1 ? ' is-major' : ''
            }`}
            style={{ left: x, top: y }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(city.timezone, city.id, e.detail ? { x: e.clientX, y: e.clientY } : undefined)
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
