/**
 * Rings that cross ±180° jump from 179.9 to -179.9; a renderer joins those
 * points with a segment across the whole world (Fiji became a band spanning
 * every ocean at 16°S). Re-express each crossing ring continuously, letting
 * longitudes run past 180 — MapLibre draws them on the adjacent world copy.
 * A ring that still does not close after unwrapping encircles a pole and is
 * closed through it.
 */
function unwrapRing(ring) {
  let shift = 0
  const out = [[ring[0][0], ring[0][1]]]
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0]
    if (dx > 180) shift -= 360
    else if (dx < -180) shift += 360
    out.push([ring[i][0] + shift, ring[i][1]])
  }
  if (shift !== 0) {
    const first = out[0]
    const last = out[out.length - 1]
    const pole = first[1] < 0 ? -90 : 90
    out.push([last[0], pole], [first[0], pole], [first[0], first[1]])
  }
  return out
}

const crosses = (ring) => ring.some((pt, i) => i > 0 && Math.abs(pt[0] - ring[i - 1][0]) > 180)

function unwrapPolygon(poly) {
  if (!poly.some(crosses)) return poly
  const rings = poly.map(unwrapRing)
  const mid = (r) => {
    const xs = r.map((p) => p[0])
    return (Math.min(...xs) + Math.max(...xs)) / 2
  }
  // Centre the shell on the primary world copy and keep holes beside it.
  const shellMid = mid(rings[0])
  const home = -Math.round(shellMid / 360) * 360
  return rings.map((r, i) => {
    const k = i === 0 ? home : Math.round((shellMid - mid(r)) / 360) * 360 + home
    return k ? r.map(([x, y]) => [x + k, y]) : r
  })
}

/** Mutates and returns the collection; reports the features it touched. */
export function unwrapAntimeridian(geo, label = (f) => f.id) {
  const touched = []
  for (const f of geo.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') {
      const next = unwrapPolygon(g.coordinates)
      if (next !== g.coordinates) {
        g.coordinates = next
        touched.push(label(f))
      }
    } else if (g.type === 'MultiPolygon') {
      let hit = false
      g.coordinates = g.coordinates.map((poly) => {
        const next = unwrapPolygon(poly)
        if (next !== poly) hit = true
        return next
      })
      if (hit) touched.push(label(f))
    }
  }
  return touched
}
