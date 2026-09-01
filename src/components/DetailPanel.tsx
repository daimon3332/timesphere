import { memo, useEffect, useRef, useState } from 'react'
import { CITY_BY_ZONE, isNauticalZone, zoneLabel } from '../lib/search'
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

export const DetailPanel = memo(function DetailPanel({ now, timezone, onClose, clickPosition }: Props) {
  const baseTimezone = useStore((s) => s.baseTimezone)
  const setBase = useStore((s) => s.setBase)
  const pinned = useStore((s) => s.pinned)
  const togglePin = useStore((s) => s.togglePin)

  const panelRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; initialX: number; initialY: number } | null>(null)

  const info = describeZone(timezone, now, baseTimezone)
  const baseInfo = describeZone(baseTimezone, now, baseTimezone)
  const label = zoneLabel(timezone)
  const baseLabel = zoneLabel(baseTimezone)
  const city = CITY_BY_ZONE.get(timezone)
  const isBase = timezone === baseTimezone
  const names = commonNames(timezone)
  const isPinned = city ? pinned.includes(city.id) : false

  // 初始化位置：如果有点击位置，智能定位在旁边，否则使用默认位置
  useEffect(() => {
    if (!clickPosition || !panelRef.current) {
      setPosition(null)
      return
    }

    const panel = panelRef.current
    const rect = panel.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let x = clickPosition.x + 20 // 点击位置右侧 20px
    let y = clickPosition.y - rect.height / 2 // 垂直居中

    // 边界检测：确保面板不超出视口
    if (x + rect.width > viewportWidth - 14) {
      x = clickPosition.x - rect.width - 20 // 放在左侧
    }
    if (y < 14) {
      y = 14
    }
    if (y + rect.height > viewportHeight - 14) {
      y = viewportHeight - rect.height - 14
    }

    setPosition({ x, y })
  }, [clickPosition, timezone])

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return

    e.preventDefault()
    setIsDragging(true)

    const rect = panelRef.current!.getBoundingClientRect()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: position?.x ?? rect.left,
      initialY: position?.y ?? rect.top,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      setPosition({
        x: dragStartRef.current.initialX + deltaX,
        y: dragStartRef.current.initialY + deltaY,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const style = position
    ? {
        position: 'fixed' as const,
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
      }
    : undefined

  return (
    <aside
      ref={panelRef}
      className={`detail${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="region"
      aria-label={`${label.titleZh} 时区详情`}
      onMouseDown={handleMouseDown}
    >
      <div className="d-head">
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
