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

  /** Keep at least EDGE px of the panel reachable, so a drag can never lose it. */
  const clampToViewport = (x: number, y: number, w: number, h: number) => {
    const EDGE = 14
    const maxX = Math.max(EDGE, window.innerWidth - w - EDGE)
    const maxY = Math.max(EDGE, window.innerHeight - h - EDGE)
    return {
      x: Math.min(Math.max(x, EDGE), maxX),
      y: Math.min(Math.max(y, EDGE), maxY),
    }
  }

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

    const rect = panelRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth

    let x = clickPosition.x + 20 // 点击位置右侧 20px
    const y = clickPosition.y - rect.height / 2 // 垂直居中

    // 右侧放不下时翻到左侧，再统一夹进视口
    if (x + rect.width > viewportWidth - 14) x = clickPosition.x - rect.width - 20

    setPosition(clampToViewport(x, y, rect.width, rect.height))
  }, [clickPosition, timezone])

  // 视口缩放后把面板拉回可见区域
  useEffect(() => {
    if (!position) return
    const onResize = () => {
      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition((p) => (p ? clampToViewport(p.x, p.y, rect.width, rect.height) : p))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [position])

  // 拖拽处理：鼠标与触摸共用一套起点记录
  const beginDrag = (target: HTMLElement, clientX: number, clientY: number) => {
    if (target.closest('button, a, input, select')) return false

    const rect = panelRef.current!.getBoundingClientRect()
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      initialX: position?.x ?? rect.left,
      initialY: position?.y ?? rect.top,
    }
    setIsDragging(true)
    return true
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return
    if (beginDrag(e.target as HTMLElement, e.clientX, e.clientY)) e.preventDefault()
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const t = e.touches[0]
    if (t) beginDrag(e.target as HTMLElement, t.clientX, t.clientY)
  }

  useEffect(() => {
    if (!isDragging) return

    const moveTo = (clientX: number, clientY: number) => {
      const start = dragStartRef.current
      const rect = panelRef.current?.getBoundingClientRect()
      if (!start || !rect) return

      setPosition(
        clampToViewport(
          start.initialX + (clientX - start.x),
          start.initialY + (clientY - start.y),
          rect.width,
          rect.height,
        ),
      )
    }

    const onMouseMove = (e: MouseEvent) => moveTo(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      e.preventDefault() // 拖拽时不要让页面跟着滚
      moveTo(t.clientX, t.clientY)
    }
    const onEnd = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [isDragging])

  const style = position
    ? {
        position: 'fixed' as const,
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        // Hide the top-right flash before the anchored position is measured.
        visibility: 'visible' as const,
      }
    : clickPosition
      ? { visibility: 'hidden' as const }
      : undefined

  return (
    <aside
      ref={panelRef}
      className={`detail${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="region"
      aria-label={`${label.titleZh} 时区详情`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
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
