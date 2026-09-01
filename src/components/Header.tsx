import { memo, useState } from 'react'
import { CITY_BY_ZONE, zoneLabel } from '../lib/search'
import { formatOffset } from '../lib/time'
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

const MODES: { key: DisplayMode; label: string }[] = [
  { key: 'iana', label: 'IANA' },
  { key: 'utc', label: 'UTC 偏移' },
  { key: 'abbreviation', label: '常见名称' },
]

export const Header = memo(function Header({ now, baseInfo, onSelect }: Props) {
  const baseTimezone = useStore((s) => s.baseTimezone)
  const displayMode = useStore((s) => s.displayMode)
  const setDisplayMode = useStore((s) => s.setDisplayMode)
  const setBase = useStore((s) => s.setBase)
  const searchOpen = useStore((s) => s.searchOpen)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const [pickerOpen, setPickerOpen] = useState(false)

  const label = zoneLabel(baseTimezone)
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
        <button className="search-trigger" onClick={() => setSearchOpen(true)}>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="search-icon">
            <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
          <span>搜索城市 / 时区 / UTC 偏移</span>
          <kbd>/</kbd>
        </button>

        <QuickTags onSelect={onSelect} />

        <select
          className="mode-select"
          value={displayMode}
          onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
          aria-label="时区命名显示方式"
        >
          {MODES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>

        <div
          className={`dst-chip${baseInfo.isDST ? ' is-active' : ''}`}
          title={
            baseInfo.isDST
              ? `${label.titleZh} 当前处于夏令时，偏移已自动调整为 ${baseInfo.utcOffset}`
              : `${label.titleZh} 当前未实行夏令时`
          }
        >
          <span className="dst-dot" aria-hidden="true" />
          夏令时 {baseInfo.isDST ? '已生效' : '自动'}
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
          onPick={(timezone) => {
            const cityId = CITY_BY_ZONE.get(timezone)?.id ?? null
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
