import { memo } from 'react'

/**
 * §29: a reference scale only. Real zone boundaries are not vertical, so this
 * never drives selection — the polygons do.
 */
export const UtcRuler = memo(function UtcRuler({ zoom }: { zoom: number }) {
  const step = zoom < 1.6 ? 2 : 1
  const marks: number[] = []
  for (let h = -12; h <= 14; h++) {
    if (h % step === 0) marks.push(h)
  }

  return (
    <div className="utc-ruler" aria-hidden="true">
      {marks.map((h) => (
        <span key={h} className={`ur-mark${h === 0 ? ' is-zero' : ''}`}>
          {h === 0 ? '0' : h > 0 ? `+${h}` : h}
        </span>
      ))}
    </div>
  )
})
