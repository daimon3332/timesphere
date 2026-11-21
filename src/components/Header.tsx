import { memo, useState } from 'react'
import { CITY_BY_ZONE, zoneLabel } from '../lib/search'
import { formatOffset, nextOffsetChange } from '../lib/time'
import { useStore } from '../store'
import type { CityTimeInfo, DisplayMode } from '../types'
import { CustomTimeControl } from './CustomTimeControl'
import { QuickTags } from './QuickTags'
import { SearchPicker } from './SearchPicker'

interface Props {
  now: Date
  baseInfo: CityTimeInfo
  onSelect: (timezone: string, cityId?: string | null) => void
}

const MODES: { key: DisplayMode; label: string; title: string }[] = [
  { key: 'iana', label: 'IANA', title: '卡片显示 IANA 时区标识，如 America/Los_Angeles' },
  { key: 'utc', label: 'UTC', title: '卡片显示 UTC 偏移，如 UTC-8' },
  { key: 'abbreviation', label: '缩写', title: '卡片显示时区缩写和偏移，如 PST · UTC-8' },
]

export const Header = memo(function Header({ now, baseInfo, onSelect }: Props) {
  const baseTimezone = useStore((s) => s.baseTimezone)
  const baseCityId = useStore((s) => s.baseCityId)
  const displayMode = useStore((s) => s.displayMode)
  const setDisplayMode = useStore((s) => s.setDisplayMode)
  const setBase = useStore((s) => s.setBase)
  const searchOpen = useStore((s) => s.searchOpen)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const [pickerOpen, setPickerOpen] = useState(false)

  const label = zoneLabel(baseTimezone, now, baseCityId)
  const dstFixed = !nextOffsetChange(baseTimezone, now)
  // The base chip always shows the IANA id plus live offset: it is the one
  // place where the professional detail is unconditionally useful.
  const baseSecondary = `${baseTimezone} · ${baseInfo.utcOffset}${
    displayMode === 'abbreviation' ? ` · ${baseInfo.abbreviation}` : ''
  }`

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="base-picker"
          onClick={() => setPickerOpen(true)}
          aria-label={`基准时区 ${label.titleZh}，点击更换`}
        >
          <span className="base-badge">基准</span>
          <span className="base-body">
            <span className="base-city">{label.titleZh}</span>
            <span className="base-meta tnum">{baseSecondary}</span>
          </span>
          <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>

        <div className="base-clock">
          <div className="clock-time tnum">
            {baseInfo.localTime}
            <span className="clock-sec">:{baseInfo.seconds}</span>
          </div>
          <div className="clock-date tnum">
            {baseInfo.date} {baseInfo.weekday}
          </div>
        </div>

        <CustomTimeControl now={now} />
      </div>

      <div className="header-right">
        <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="搜索城市或时区">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="search-icon">
            <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
          <span>搜索城市 / 时区 / UTC 偏移</span>
          <kbd>/</kbd>
        </button>

        <QuickTags now={now} onSelect={onSelect} />

        <div className="tm-switch display-switch" role="radiogroup" aria-label="卡片时区显示方式">
          {MODES.map((m) => (
            <button
              key={m.key}
              role="radio"
              aria-checked={displayMode === m.key}
              className={`tm-btn${displayMode === m.key ? ' is-on' : ''}`}
              title={m.title}
              onClick={() => setDisplayMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div
          className={`dst-chip${baseInfo.isDST ? ' is-active' : ''}`}
          title={
            baseInfo.isDST
              ? `${label.titleZh} 当前处于夏令时，偏移已自动调整为 ${baseInfo.utcOffset}`
              : dstFixed
                ? `${label.titleZh} 全年固定 ${baseInfo.utcOffset}，不实行夏令时`
                : `${label.titleZh} 当前未处于夏令时，切换时会自动调整`
          }
        >
          <span className="dst-dot" aria-hidden="true" />
          {baseInfo.isDST ? '夏令时 已生效' : dstFixed ? '无夏令时' : '夏令时 未生效'}
        </div>
      </div>

      {(pickerOpen || searchOpen) && (
        <SearchPicker
          now={now}
          mode={pickerOpen ? 'base' : 'select'}
          onClose={() => {
            setPickerOpen(false)
            setSearchOpen(false)
          }}
          onPick={(timezone, selectedCityId) => {
            const cityId = selectedCityId ?? CITY_BY_ZONE.get(timezone)?.id ?? null
            if (pickerOpen) setBase(timezone, cityId)
            else onSelect(timezone, cityId)
            setPickerOpen(false)
            setSearchOpen(false)
          }}
        />
      )}
    </header>
  )
})

export { formatOffset }
