import type { Map as MlMap } from 'maplibre-gl'
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cityForTimezone, isNauticalZone, zoneLabel } from '../lib/search'
import { TZ_GROUPS } from '../data/tz-groups'
import { DAY_RELATION_ZH, describeZone, formatDifference, nextOffsetChange } from '../lib/time'
import { useStore, type PanelAnchor } from '../store'
import { ZoneGuideSection } from './ZoneGuideSection'

interface Props {
  now: Date
  timezone: string
  onClose: () => void
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
const GAP = 28
const SHEET_QUERY = '(max-width: 720px)'

type Point = { x: number; y: number }

function clampToViewport({ x, y }: Point, w: number, h: number): Point {
  return {
    x: Math.min(Math.max(x, EDGE), Math.max(EDGE, innerWidth - w - EDGE)),
    y: Math.min(Math.max(y, EDGE), Math.max(EDGE, innerHeight - h - EDGE)),
  }
}

/** Screen point of a map anchor, or null when it is not on a visible part of the map. */
function mapPoint(map: MlMap, lngLat: [number, number]): Point | null {
  const canvas = map.getCanvas()
  const box = canvas.getBoundingClientRect()
  let best: Point | null = null
  for (const shift of [0, -360, 360]) {
    const p = map.project([lngLat[0] + shift, lngLat[1]])
    if (!best || Math.abs(p.x - box.width / 2) < Math.abs(best.x - box.width / 2)) best = p
  }
  if (!best) return null
  const x = box.left + best.x
  const y = box.top + best.y
  const visible =
    x >= Math.max(box.left, 0) && x <= Math.min(box.right, innerWidth) &&
    y >= Math.max(box.top, 0) && y <= Math.min(box.bottom, innerHeight)
  return visible ? { x, y } : null
}

/** Where the panel goes for an anchor: beside it, flipping sides when there is no room. */
function besideAnchor(anchor: PanelAnchor | null, map: MlMap | null, w: number, h: number): Point | null {
  if (anchor?.kind === 'map') {
    const p = map && mapPoint(map, anchor.lngLat)
    if (!p) return null
    const x = p.x + GAP + w <= innerWidth - EDGE ? p.x + GAP : p.x - GAP - w
    return clampToViewport({ x, y: p.y - Math.min(56, h / 2) }, w, h)
  }
  if (anchor?.kind === 'rect') {
    const r = {
      left: anchor.rect.left - scrollX,
      right: anchor.rect.right - scrollX,
      top: anchor.rect.top - scrollY,
      bottom: anchor.rect.bottom - scrollY,
    }
    if (r.right + 10 + w <= innerWidth - EDGE) return clampToViewport({ x: r.right + 10, y: r.top }, w, h)
    if (r.left - 10 - w >= EDGE) return clampToViewport({ x: r.left - 10 - w, y: r.top }, w, h)
    return clampToViewport({ x: r.left, y: r.bottom + 8 }, w, h)
  }
  return null
}

const monthDay = (d: Date, offset: number) => {
  const local = new Date(d.getTime() + offset * 60_000)
  return `${local.getUTCMonth() + 1} 月 ${local.getUTCDate()} 日`
}

export const DetailPanel = memo(function DetailPanel({ now, timezone, onClose }: Props) {
  const baseTimezone = useStore((s) => s.baseTimezone)
  const baseCityId = useStore((s) => s.baseCityId)
  const selectedCityId = useStore((s) => s.selectedCityId)
  const anchor = useStore((s) => s.anchor)
  const map = useStore((s) => s.map)
  const setBase = useStore((s) => s.setBase)
  const pinned = useStore((s) => s.pinned)
  const togglePin = useStore((s) => s.togglePin)

  const panelRef = useRef<HTMLElement>(null)
  /** Set once the user drags; wins over the anchor until the panel closes. */
  const dragged = useRef<Point | null>(null)
  const dragStart = useRef<{ x: number; y: number; from: Point; pointerId: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const info = describeZone(timezone, now, baseTimezone)
  const baseInfo = describeZone(baseTimezone, now, baseTimezone)
  const label = zoneLabel(timezone, now, selectedCityId)
  const baseLabel = zoneLabel(baseTimezone, now, baseCityId)
  const city = cityForTimezone(timezone, selectedCityId)
  const isBase = timezone === baseTimezone && (!city || city.id === baseCityId)
  const names = commonNames(timezone)
  const isPinned = city ? pinned.includes(city.id) : false
  const change = nextOffsetChange(timezone, now)

  /**
   * Positions are written straight to the element so the panel moves in the
   * same frame as the map it is attached to. Mobile keeps the CSS bottom sheet.
   */
  const place = useCallback(() => {
    const el = panelRef.current
    if (!el) return
    const reset = () => {
      el.style.left = el.style.top = el.style.right = el.style.bottom = ''
    }
    if (matchMedia(SHEET_QUERY).matches) return reset()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const pos = dragged.current ? clampToViewport(dragged.current, w, h) : besideAnchor(anchor, map, w, h)
    if (!pos) return reset()
    el.style.left = `${pos.x}px`
    el.style.top = `${pos.y}px`
    el.style.right = el.style.bottom = 'auto'
  }, [anchor, map])

  useLayoutEffect(() => {
    place()
    const el = panelRef.current
    const observer = new ResizeObserver(place)
    if (el) observer.observe(el)
    map?.on('move', place)
    map?.on('resize', place)
    addEventListener('scroll', place, { passive: true })
    addEventListener('resize', place)
    return () => {
      observer.disconnect()
      map?.off('move', place)
      map?.off('resize', place)
      removeEventListener('scroll', place)
      removeEventListener('resize', place)
    }
  }, [place, map])

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || (e.target as Element).closest('button')) return
    if (matchMedia(SHEET_QUERY).matches) return
    const rect = panelRef.current!.getBoundingClientRect()
    dragStart.current = { x: e.clientX, y: e.clientY, from: { x: rect.left, y: rect.top }, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    setIsDragging(true)
  }

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start || start.pointerId !== e.pointerId) return
    dragged.current = { x: start.from.x + e.clientX - start.x, y: start.from.y + e.clientY - start.y }
    place()
  }

  const endDrag = () => {
    dragStart.current = null
    setIsDragging(false)
  }

  const dstText = !change
    ? '不实行 · 全年固定'
    : info.isDST
      ? `生效中 · ${monthDay(change.at, change.from)}结束`
      : `未生效 · ${monthDay(change.at, change.from)}开始`

  return (
    <aside
      ref={panelRef}
      className={`detail${isDragging ? ' is-dragging' : ''}`}
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
          <dd className={info.isDST ? 'dst-on' : ''}>{dstText}</dd>
        </div>
        {names && (
          <div>
            <dt>常见名称</dt>
            <dd className="tnum">{names}</dd>
          </div>
        )}
      </dl>

      <ZoneGuideSection now={now} timezone={timezone} baseTimezone={baseTimezone} baseName={baseLabel.titleZh} />

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
