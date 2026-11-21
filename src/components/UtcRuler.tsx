import type { Map as MlMap } from 'maplibre-gl'
import { memo, useEffect, useRef } from 'react'

/**
 * §29: a reference scale only. Real zone boundaries are not vertical, so this
 * never drives selection — the polygons do.
 *
 * Marks sit on the nautical band centres (every 15°) as projected by the map,
 * so they stay true while panning across world copies. Written straight to
 * the DOM in the map's move event to stay in step with the canvas.
 */
export const UtcRuler = memo(function UtcRuler({ map }: { map: MlMap | null }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!map || !el) return
    const draw = () => {
      const w = map.getCanvas().clientWidth
      const west = map.unproject([0, 0]).lng
      const east = map.unproject([w, 0]).lng
      const band = map.project([15, 0]).x - map.project([0, 0]).x
      const step = band < 30 ? 2 : 1
      const marks: HTMLSpanElement[] = []
      for (let k = Math.ceil(west / 15); k <= Math.floor(east / 15); k++) {
        let h = ((k % 24) + 24) % 24
        if (h > 12) h -= 24
        if (h % step !== 0) continue
        const x = map.project([k * 15, 0]).x
        if (x < 10 || x > w - 10) continue
        const mark = document.createElement('span')
        mark.className = h === 0 ? 'ur-mark is-zero' : 'ur-mark'
        mark.style.left = `${x}px`
        mark.textContent = h === 0 ? '0' : Math.abs(h) === 12 ? '±12' : h > 0 ? `+${h}` : `${h}`
        marks.push(mark)
      }
      el.replaceChildren(...marks)
    }
    draw()
    map.on('move', draw)
    map.on('resize', draw)
    return () => {
      map.off('move', draw)
      map.off('resize', draw)
    }
  }, [map])

  return <div className="utc-ruler" ref={ref} aria-hidden="true" />
})
