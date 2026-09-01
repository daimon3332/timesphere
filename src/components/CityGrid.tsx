import { memo, useMemo } from 'react'
import { CITIES } from '../data/cities'
import { CITY_BY_ID, CITY_BY_ZONE, zoneLabel } from '../lib/search'
import { describeZone } from '../lib/time'
import { useStore, type RegionFilter } from '../store'
import type { City } from '../types'
import { CityCard } from './CityCard'

interface Props {
  now: Date
  onSelect: (timezone: string, cityId?: string | null) => void
}

const FILTERS: { key: RegionFilter; label: string }[] = [
  { key: 'pinned', label: '我的城市' },
  { key: 'all', label: '全部' },
  { key: 'asia', label: '亚洲' },
  { key: 'europe', label: '欧洲' },
  { key: 'north-america', label: '北美' },
  { key: 'south-america', label: '南美' },
  { key: 'middle-east', label: '中东' },
  { key: 'africa', label: '非洲' },
  { key: 'oceania', label: '大洋洲' },
]

export const CityGrid = memo(function CityGrid({ now, onSelect }: Props) {
  const baseTimezone = useStore((s) => s.baseTimezone)
  const selectedTimezone = useStore((s) => s.selectedTimezone)
  const displayMode = useStore((s) => s.displayMode)
  const regionFilter = useStore((s) => s.regionFilter)
  const setRegionFilter = useStore((s) => s.setRegionFilter)
  const pinned = useStore((s) => s.pinned)

  const baseLabel = zoneLabel(baseTimezone).titleZh
  // Only one card is "the base"; siblings in the same zone are marked as
  // sharing it rather than duplicating the badge.
  const baseCityId = CITY_BY_ZONE.get(baseTimezone)?.id
  const selectedCityId = selectedTimezone ? CITY_BY_ZONE.get(selectedTimezone)?.id : undefined

  const cities = useMemo<City[]>(() => {
    let list: City[]
    if (regionFilter === 'pinned') {
      list = pinned.map((id) => CITY_BY_ID.get(id)).filter((c): c is City => Boolean(c))
    } else if (regionFilter === 'all') {
      // "All" would be 133 cards; lead with the pinned set then the rest by tier.
      const pinnedSet = new Set(pinned)
      const rest = CITIES.filter((c) => !pinnedSet.has(c.id)).sort(
        (a, b) => a.priority - b.priority || a.nameZh.localeCompare(b.nameZh),
      )
      list = [
        ...pinned.map((id) => CITY_BY_ID.get(id)).filter((c): c is City => Boolean(c)),
        ...rest,
      ]
    } else {
      list = CITIES.filter((c) => c.region === regionFilter).sort(
        (a, b) => a.priority - b.priority || a.nameZh.localeCompare(b.nameZh),
      )
    }
    // Every card reads 快/慢 against the base, so the base must be on screen
    // even when the active filter excludes it (base 上海 + filter 欧洲, or an
    // unpinned base under 我的城市). Move it to the front, or insert it.
    const baseIdx = list.findIndex((c) => c.id === baseCityId)
    if (baseIdx > 0) {
      const [b] = list.splice(baseIdx, 1)
      list.unshift(b!)
    } else if (baseIdx === -1 && baseCityId) {
      const baseCity = CITY_BY_ID.get(baseCityId)
      if (baseCity) list.unshift(baseCity)
    }
    return list
  }, [regionFilter, pinned, baseCityId])

  const counts = useMemo(() => {
    const ahead = cities.filter(
      (c) => describeZone(c.timezone, now, baseTimezone).differenceMinutes > 0,
    ).length
    return { total: cities.length, ahead }
  }, [cities, now, baseTimezone])

  return (
    <section className="grid-section" aria-label="全球主要城市当前时间">
      <div className="grid-head">
        <div className="filters" role="tablist" aria-label="城市分组">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={regionFilter === f.key}
              className={`filter${regionFilter === f.key ? ' is-on' : ''}`}
              onClick={() => setRegionFilter(f.key)}
            >
              {f.label}
              {f.key === 'pinned' && <span className="filter-count">{pinned.length}</span>}
            </button>
          ))}
        </div>
        <div className="grid-legend">
          <span className="lg behind">慢</span>
          <span className="lg same">相同</span>
          <span className="lg ahead">快</span>
          <span className="grid-count tnum">
            {counts.total} 个城市 · {counts.ahead} 个更早
          </span>
        </div>
      </div>

      <div className="grid-scroll">
      <div className="city-grid">
        {cities.map((c) => (
          <CityCard
            key={c.id}
            city={c}
            info={describeZone(c.timezone, now, baseTimezone)}
            isBase={c.id === baseCityId}
            isSelected={c.id === selectedCityId}
            sharesBaseZone={c.timezone === baseTimezone && c.id !== baseCityId}
            displayMode={displayMode}
            baseLabel={baseLabel}
            onSelect={() => onSelect(c.timezone, c.id)}
          />
        ))}
        {regionFilter === 'pinned' && pinned.length === 0 && (
          <div className="grid-hint">
            还没有收藏城市。点击任意城市后，在详情面板选择 <strong>加入我的城市</strong>。
          </div>
        )}
        {cities.length === 0 && (
          <div className="grid-empty">
            该分组还没有城市，点击上方 <strong>全部</strong> 查看所有城市。
          </div>
        )}
      </div>
      </div>
    </section>
  )
})
