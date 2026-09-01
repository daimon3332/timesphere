import { memo } from 'react'
import { DAY_RELATION_ZH, formatDifference, formatDifferenceShort } from '../lib/time'
import type { City, CityTimeInfo, DisplayMode } from '../types'

interface Props {
  city: City
  info: CityTimeInfo
  isBase: boolean
  isSelected: boolean
  /** same zone as the base, but not the representative city */
  sharesBaseZone: boolean
  displayMode: DisplayMode
  baseLabel: string
  onSelect: () => void
}

function diffClass(minutes: number) {
  if (minutes === 0) return 'same'
  return minutes > 0 ? 'ahead' : 'behind'
}

export const CityCard = memo(function CityCard({
  city,
  info,
  isBase,
  isSelected,
  sharesBaseZone,
  displayMode,
  baseLabel,
  onSelect,
}: Props) {
  // §9: the mode selects what professional detail is shown, verbatim.
  // Long ids ellipsize; the title attribute always carries the full value.
  const meta =
    displayMode === 'iana'
      ? city.timezone
      : displayMode === 'utc'
        ? info.utcOffset
        : `${info.abbreviation} · ${info.utcOffset}`

  const diffText = isBase ? '基准' : formatDifference(info.differenceMinutes, baseLabel)
  const dayShift = info.dayRelation !== 'today'

  return (
    <button
      className={`city-card${isBase ? ' is-base' : ''}${isSelected ? ' is-selected' : ''}${
        sharesBaseZone ? ' shares-base' : ''
      }`}
      onClick={onSelect}
      aria-label={`${city.nameZh}，当前时间 ${info.localTime}，${info.date} ${info.weekday}，${
        isBase ? '基准时区' : diffText
      }`}
      aria-pressed={isSelected}
    >
      <span className="cc-top">
        <span className="cc-name">{city.nameZh}</span>
        {isBase && <span className="cc-flag base">基准</span>}
        {sharesBaseZone && <span className="cc-flag shares">同区</span>}
        {!isBase && dayShift && (
          <span className={`cc-day ${info.dayRelation}`}>{DAY_RELATION_ZH[info.dayRelation]}</span>
        )}
      </span>

      <span className="cc-time tnum">{info.localTime}</span>

      <span className="cc-date tnum">
        {info.shortDate} {info.weekday}
      </span>

      <span className="cc-bottom">
        <span className={`cc-diff ${isBase ? 'base' : diffClass(info.differenceMinutes)}`}>
          {isBase ? '基准' : formatDifferenceShort(info.differenceMinutes)}
        </span>
        <span
          className={`cc-meta tnum${displayMode === 'iana' ? ' is-iana' : ''}`}
          title={`${city.timezone} · ${info.abbreviation} · ${info.utcOffset}`}
        >
          {meta}
        </span>
      </span>
    </button>
  )
})
