import { memo, useState } from 'react'
import { otherMeanings } from '../data/abbr-glossary'
import { GUIDE_BY_ZONE } from '../data/zone-guides'
import { formatDifference, formatOffset, nextOffsetChange, offsetMinutes, zoneNaming } from '../lib/time'
import { upcomingZoneNames } from '../lib/zone-names'

interface Props {
  now: Date
  timezone: string
  baseTimezone: string
  baseName: string
}

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** Wall clock of an instant at a fixed offset. */
function wall(at: Date, offset: number) {
  const d = new Date(at.getTime() + offset * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${WEEKDAY_ZH[d.getUTCDay()]}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  }
}

/**
 * "GMT / BST 是什么？" for any zone with letter abbreviations: what each name
 * stands for, which one is in force, when it next switches, and what else the
 * same letters can mean. North American zones add colloquial context
 * (美西时间 / 美东时间) from the zone guides.
 */
export const ZoneNamesSection = memo(function ZoneNamesSection({ now, timezone, baseTimezone, baseName }: Props) {
  const [open, setOpen] = useState(false)
  const names = upcomingZoneNames(timezone, now).filter((n) => n.lettered)
  if (names.length === 0) return null

  const guide = GUIDE_BY_ZONE.get(timezone)
  const off = offsetMinutes(timezone, now)
  const currentAbbr = zoneNaming(timezone, now).abbreviation
  const exception = guide?.exceptions[timezone]
  const stale =
    exception?.expect && now >= new Date(exception.expect.since) && off !== exception.expect.offset
      ? exception.expect
      : null
  const change = nextOffsetChange(timezone, now)
  // A base with its own DST would make "summer vs winter" differences lie.
  const baseOff = nextOffsetChange(baseTimezone, now) ? null : offsetMinutes(baseTimezone, now)
  const nextAbbr = change && zoneNaming(timezone, change.at).abbreviation
  const own = new Set(names.map((n) => n.entry))
  const homonyms = [...new Set(names.flatMap((n) => (n.entry ? otherMeanings(n.entry) : [])))].filter(
    (h) => !own.has(h),
  )

  return (
    <details className="d-guide" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="g-hint">
          <b className="tnum">{names.map((n) => n.abbr).join(' / ')}</b> 是什么？
        </span>
        {guide && (
          <span className="g-title">
            {guide.colloquialZh && <>{guide.colloquialZh} · </>}
            {guide.titleZh}
            <span className="g-en">{guide.titleEn}</span>
          </span>
        )}
      </summary>

      {guide && <p className="g-summary">{guide.summaryZh}</p>}
      {exception && <p className="g-callout">{exception.noteZh}</p>}
      {stale && (
        <p className="g-callout is-warn">
          你的浏览器或系统时区数据较旧，这里仍按 {formatOffset(off)} 计算，实际应为 {formatOffset(stale.offset)}。
          更新浏览器或系统后会自动恢复正常。
        </p>
      )}

      <ul className="g-variants">
        {names.map((n) => {
          const current = n.abbr === currentAbbr && n.offset === off
          return (
            <li key={`${n.abbr}${n.offset}`} className={current ? 'is-now' : undefined}>
              <b className="tnum">{n.abbr}</b>
              <span className="g-name">
                {n.nameZh}
                <small>{n.nameEn}</small>
              </span>
              <span className="g-off tnum">
                {n.offset === 0 ? 'UTC+0' : formatOffset(n.offset)}
                {current && <em>当前</em>}
              </span>
              <span className="g-period">
                {[n.regionZh, n.periodZh].filter(Boolean).join(' · ')}
                {baseOff !== null && timezone !== baseTimezone && (
                  <>
                    {n.regionZh || n.periodZh ? ' · ' : ''}
                    {n.offset === baseOff
                      ? `与${baseName}相同`
                      : `比${baseName}${formatDifference(n.offset - baseOff, baseName)}`}
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {change ? (
        <p className="g-next">
          下次切换：<span className="tnum">{wall(change.at, change.from).date}</span>，当地{' '}
          <span className="tnum">{wall(change.at, change.from).time}</span> 拨{change.to > change.from ? '快' : '慢'}到{' '}
          <span className="tnum">{wall(change.at, change.to).time}</span>
          {nextAbbr && nextAbbr !== currentAbbr && <>，改用 {nextAbbr}</>}
        </p>
      ) : (
        <p className="g-next">全年使用同一时间，不调整时钟。</p>
      )}

      {homonyms.length > 0 && (
        <p className="g-note">
          注意同名缩写：
          {homonyms.map((h, i) => (
            <span key={`${h.abbr}${h.offset}`}>
              {i > 0 && '；'}
              {h.abbr} 也可指{h.nameZh}（{formatOffset(h.offset)}）
            </span>
          ))}
          。
        </p>
      )}

      {guide && (
        <p className="g-cities">
          <span>代表城市</span>
          {guide.citiesZh}
        </p>
      )}
      {guide?.notesZh.map((n) => (
        <p key={n} className="g-note">
          {n}
        </p>
      ))}
    </details>
  )
})
