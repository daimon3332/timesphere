import { memo, useLayoutEffect, useRef, useState } from 'react'
import { cityForTimezone, isNauticalZone, zoneLabel } from '../lib/search'
import { TZ_GROUPS } from '../data/tz-groups'
import { DAY_RELATION_ZH, describeZone, formatDifference } from '../lib/time'
import { useStore } from '../store'

interface Props {
  now: Date
  timezone: string
  onClose: () => void
  clickPosition?: { x: number; y: number } | null
}

/** Common names for a zone, for the "常见名称" row. */
function commonNames(timezone: string): string {
  const hits = new Set<string>()
  for (const g of TZ_GROUPS) {
    if (g.zones.some((z) => z.timezone === timezone)) {
      for (const a of g.aliases) {
        if (/^[A-Z]{2,5}$/.test(a)) hits.add(a)
      }
    }
  }
  return [...hits].join(' / ')
}

const EDGE = 14

function clampToViewport(x: number, y: number, w: number, h: number) {
  return {
    x: Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - w - EDGE)),
    y: Math.min(Math.max(y, EDGE), Math.max(EDGE, window.innerHeight - h - EDGE)),
  }
}

export const DetailPanel = memo(function DetailPanel({ now, timezone, onClose, clickPosition }: Props) {
  const baseTimezone = useStore((s) => s.baseTimezone)
  const baseCityId = useStore((s) => s.baseCityId)
  const selectedCityId = useStore((s) => s.selectedCityId)
  const setBase = useStore((s) => s.setBase)
  const pinned = useStore((s) => s.pinned)
  const togglePin = useStore((s) => s.togglePin)

  const panelRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; initialX: number; initialY: number; pointerId: number } | null>(null)

  const info = describeZone(timezone, now, baseTimezone)
  const baseInfo = describeZone(baseTimezone, now, baseTimezone)
  const label = zoneLabel(timezone, now, selectedCityId)
  const baseLabel = zoneLabel(baseTimezone, now, baseCityId)
  const city = cityForTimezone(timezone, selectedCityId)
  const isBase = timezone === baseTimezone && (!city || city.id === baseCityId)
  const names = commonNames(timezone)
  const isPinned = city ? pinned.includes(city.id) : false

  useLayoutEffect(() => {
    if (!clickPosition || !panelRef.current) {
      setPosition(null)
      return
    }

    const rect = panelRef.current.getBoundingClientRect()
    let x = clickPosition.x + 20
    const y = clickPosition.y - rect.height / 2

    if (x + rect.width > window.innerWidth - EDGE) x = clickPosition.x - rect.width - 20

    setPosition(clampToViewport(x, y, rect.width, rect.height))
  }, [clickPosition, timezone, selectedCityId])

  useLayoutEffect(() => {
    const onResize = () => {
      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition((p) => {
        if (!p) return p
        const next = clampToViewport(p.x, p.y, rect.width, rect.height)
        return next.x === p.x && next.y === p.y ? p : next
      })
    }
    const observer = new ResizeObserver(onResize)
    if (panelRef.current) observer.observe(panelRef.current)
    window.addEventListener('resize', onResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || (e.target as Element).closest('button')) return
    const rect = panelRef.current!.getBoundingClientRect()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: position?.x ?? rect.left,
      initialY: position?.y ?? rect.top,
      pointerId: e.pointerId,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    setIsDragging(true)
  }

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    const rect = panelRef.current?.getBoundingClientRect()
    if (!start || start.pointerId !== e.pointerId || !rect) return
    setPosition(clampToViewport(start.initialX + e.clientX - start.x,
      start.initialY + e.clientY - start.y, rect.width, rect.height))
  }

  const endDrag = () => {
    dragStartRef.current = null
    setIsDragging(false)
  }

  const style = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        bottom: 'auto',
      }
    : undefined

  return (
    <aside
      ref={panelRef}
      className={`detail${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="region"
      aria-label={`${label.titleZh} 时区详情`}
    >
      <div className="d-head" onPointerDown={beginDrag} onPointerMove={moveDrag}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
        <div>
          <div className="d-title">
            {label.titleZh}
            <span className="d-country">{label.subtitleZh}</span>
          </div>
          {/* Etc/GMT ids are POSIX-inverted, so they are not shown verbatim. */}
          <div className="d-zone tnum">{isNauticalZone(timezone) ? '航海时区' : timezone}</div>
        </div>
        <button className="d-close" onClick={onClose} aria-label="关闭详情">
          ×
        </button>
      </div>

      <div className="d-hero">
        <div className="d-hero-time tnum">
          {info.localTime}
          <span className="d-hero-sec">:{info.seconds}</span>
        </div>
        <div className="d-hero-side">
          <span className="tnum">{info.date}</span>
          <span>{info.weekday}</span>
          {info.dayRelation !== 'today' && (
            <span className={`d-day ${info.dayRelation}`}>
              {DAY_RELATION_ZH[info.dayRelation]}
            </span>
          )}
        </div>
      </div>

      <dl className="d-rows">
        <div>
          <dt>当前时区名称</dt>
          <dd className="tnum">{info.abbreviation}</dd>
        </div>
        <div>
          <dt>UTC 偏移</dt>
          <dd className="tnum">{info.utcOffset}</dd>
        </div>
        <div>
          <dt>与{baseLabel.titleZh}时差</dt>
          <dd className={info.differenceMinutes === 0 ? 'same' : info.differenceMinutes > 0 ? 'ahead' : 'behind'}>
            {isBase ? '当前基准' : formatDifference(info.differenceMinutes, baseLabel.titleZh)}
          </dd>
        </div>
        <div>
          <dt>夏令时</dt>
          <dd className={info.isDST ? 'dst-on' : ''}>
            {info.isDST ? '已自动生效' : '自动 · 当前未生效'}
          </dd>
        </div>
        {names && (
          <div>
            <dt>常见名称</dt>
            <dd className="tnum">{names}</dd>
          </div>
        )}
      </dl>

      {!isBase && (
        <div className="d-compare">
          <span className="dc-side">
            <em>{baseLabel.titleZh}</em>
            <b className="tnum">{baseInfo.localTime}</b>
          </span>
          <svg className="dc-arrow" viewBox="0 0 24 12" aria-hidden="true">
            <path d="M0 6h20M16 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="dc-side">
            <em>{label.titleZh}</em>
            <b className="tnum">{info.localTime}</b>
          </span>
        </div>
      )}

      <div className="d-actions">
        {!isBase && (
          <button className="btn primary" onClick={() => setBase(timezone, city?.id ?? null)}>
            设为基准
          </button>
        )}
        {city && (
          <button className="btn" onClick={() => togglePin(city.id)}>
            {isPinned ? '从我的城市移除' : '加入我的城市'}
          </button>
        )}
      </div>
    </aside>
  )
})
