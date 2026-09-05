import { memo, useEffect, useState } from 'react'
import { resolveZonedWallClock, zonedParts } from '../lib/time'
import { useStore } from '../store'

const pad = (n: number) => String(n).padStart(2, '0')

/** §33–34: "现在" by default, with a reserved slot for planning a meeting. */
export const CustomTimeControl = memo(function CustomTimeControl({ now }: { now: Date }) {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const setCustomDateTime = useStore((s) => s.setCustomDateTime)
  const baseTimezone = useStore((s) => s.baseTimezone)

  const p = zonedParts(baseTimezone, now)
  const [date, setDate] = useState(`${String(p.year).padStart(4, '0')}-${pad(p.month)}-${pad(p.day)}`)
  const [time, setTime] = useState(`${pad(p.hour)}:${pad(p.minute)}`)
  const [notice, setNotice] = useState<string | null>(null)

  // Changing the base changes the wall clock, never the planned instant.
  useEffect(() => {
    if (mode !== 'custom') return
    const q = zonedParts(baseTimezone, useStore.getState().customDateTime ?? new Date())
    setDate(`${String(q.year).padStart(4, '0')}-${pad(q.month)}-${pad(q.day)}`)
    setTime(`${pad(q.hour)}:${pad(q.minute)}`)
    setNotice(null)
  }, [mode, baseTimezone])

  const update = (nextDate: string, nextTime: string) => {
    setDate(nextDate)
    setTime(nextTime)
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextDate)
    const tm = /^(\d{1,2}):(\d{2})$/.exec(nextTime)
    if (!dm || !tm) {
      setNotice('请输入完整的日期和时间')
      return
    }
    try {
      const { instant, resolution } = resolveZonedWallClock(
        baseTimezone,
        Number(dm[1]),
        Number(dm[2]),
        Number(dm[3]),
        Number(tm[1]),
        Number(tm[2]),
      )
      setCustomDateTime(instant)
      if (resolution === 'gap') {
        const p = zonedParts(baseTimezone, instant)
        setNotice(`该时刻因夏令时切换不存在，已调整为 ${pad(p.hour)}:${pad(p.minute)}`)
      } else if (resolution === 'ambiguous') {
        setNotice('该时刻因夏令时结束出现两次，已按第一次计算')
      } else {
        setNotice(null)
      }
    } catch {
      setNotice('请输入有效的日期和时间')
    }
  }

  return (
    <div className="time-mode">
      <div className="tm-switch" role="group" aria-label="时间模式">
        <button
          className={`tm-btn${mode === 'now' ? ' is-on' : ''}`}
          aria-pressed={mode === 'now'}
          onClick={() => setMode('now')}
        >
          现在
        </button>
        <button
          className={`tm-btn${mode === 'custom' ? ' is-on' : ''}`}
          aria-pressed={mode === 'custom'}
          onClick={() => setMode('custom')}
        >
          指定时间
        </button>
      </div>
      {mode === 'custom' && (
        <div className="tm-fields">
          <input
            id="tz-custom-date"
            name="tz-custom-date"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            onChange={(e) => update(e.target.value, time)}
            aria-label="指定日期"
          />
          <input
            id="tz-custom-time"
            name="tz-custom-time"
            type="time"
            value={time}
            onChange={(e) => update(date, e.target.value)}
            aria-label="指定时间"
          />
          {notice && (
            <span className="tm-notice" role="status">
              {notice}
            </span>
          )}
        </div>
      )}
    </div>
  )
})
