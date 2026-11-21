import { memo, useState } from 'react'
import { GUIDE_BY_ZONE } from '../data/zone-guides'
import { formatDifference, formatOffset, nextOffsetChange, offsetMinutes } from '../lib/time'

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
 * "美西时间 / PST / PDT 是什么" for North American zones. Which variant is in
 * force and when it next switches come from the platform clock, not prose.
 */
export const ZoneGuideSection = memo(function ZoneGuideSection({ now, timezone, baseTimezone, baseName }: Props) {
  const [open, setOpen] = useState(false)
  const guide = GUIDE_BY_ZONE.get(timezone)
  if (!guide) return null

  const off = offsetMinutes(timezone, now)
  const follows = guide.zones.includes(timezone)
  const exception = guide.exceptions[timezone]
  const stale =
    exception?.expect && now >= new Date(exception.expect.since) && off !== exception.expect.offset
      ? exception.expect
      : null
  const change = follows ? nextOffsetChange(timezone, now) : null
  // A base with its own DST would make "summer vs winter" differences lie.
  const baseOff = nextOffsetChange(baseTimezone, now) ? null : offsetMinutes(baseTimezone, now)
  const variants = guide.daylight ? [guide.standard, guide.daylight] : [guide.standard]
  const nextAbbr = change && variants.find((v) => v.offset === change.to)?.abbr

  return (
    <details className="d-guide" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="g-title">
          {guide.colloquialZh && <>{guide.colloquialZh} · </>}
          {guide.titleZh}
          <span className="g-en">{guide.titleEn}</span>
        </span>
        <span className="g-hint">{variants.map((v) => v.abbr).join(' / ')} 是什么？</span>
      </summary>

      <p className="g-summary">{guide.summaryZh}</p>
      {exception && <p className="g-callout">{exception.noteZh}</p>}
      {stale && (
        <p className="g-callout is-warn">
          你的浏览器或系统时区数据较旧，这里仍按 {formatOffset(off)} 计算，实际应为 {formatOffset(stale.offset)}。
          更新浏览器或系统后会自动恢复正常。
        </p>
      )}

      <ul className="g-variants">
        {variants.map((v) => {
          const current = follows && v.offset === off
          return (
            <li key={v.abbr} className={current ? 'is-now' : undefined}>
              <b className="tnum">{v.abbr}</b>
              <span className="g-name">
                {v.nameZh}
                <small>{v.nameEn}</small>
              </span>
              <span className="g-off tnum">
                {formatOffset(v.offset)}
                {current && <em>当前</em>}
              </span>
              <span className="g-period">
                {v.periodZh}
                {baseOff !== null && timezone !== baseTimezone && (
                  <>
                    {' · '}
                    {v.offset === baseOff ? `与${baseName}相同` : `比${baseName}${formatDifference(v.offset - baseOff, baseName)}`}
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {change && (
        <p className="g-next">
          下次切换：<span className="tnum">{wall(change.at, change.from).date}</span>，当地{' '}
          <span className="tnum">{wall(change.at, change.from).time}</span> 拨{change.to > change.from ? '快' : '慢'}到{' '}
          <span className="tnum">{wall(change.at, change.to).time}</span>
          {nextAbbr && <>，改用 {nextAbbr}</>}
        </p>
      )}
      {guide.daylight && <p className="g-rule">美国和加拿大多数地区的夏令时：3 月第二个周日开始，11 月第一个周日结束，均在当地凌晨 2 点切换。</p>}

      <p className="g-cities">
        <span>代表城市</span>
        {guide.citiesZh}
      </p>
      {guide.notesZh.map((n) => (
        <p key={n} className="g-note">
          {n}
        </p>
      ))}
    </details>
  )
})
