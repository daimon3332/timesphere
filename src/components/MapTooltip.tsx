import { memo } from 'react'

export interface TooltipData {
  x: number
  y: number
  title: string
  time?: string
  meta?: string
  diff?: string
  dayNote?: string
  zoneNote?: string
}

export const MapTooltip = memo(function MapTooltip({ data }: { data: TooltipData }) {
  // Flip sides near the right/bottom edge so the tip never leaves the map.
  const flipX = data.x > window.innerWidth - 230
  const flipY = data.y < 120

  return (
    <div
      className="map-tip"
      style={{
        left: data.x,
        top: data.y,
        transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, ${
          flipY ? '8px' : 'calc(-100% - 12px)'
        })`,
      }}
      role="tooltip"
    >
      <div className="mt-title">{data.title}</div>
      {data.time && <div className="mt-time tnum">{data.time}</div>}
      {data.dayNote && <div className="mt-day tnum">{data.dayNote}</div>}
      {data.meta && <div className="mt-meta tnum">{data.meta}</div>}
      {data.diff && <div className="mt-diff">{data.diff}</div>}
      {data.zoneNote && <div className="mt-zone tnum">{data.zoneNote}</div>}
    </div>
  )
})
