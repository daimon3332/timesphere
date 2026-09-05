import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CITIES } from '../data/cities'
import { searchTimezones, type SearchResult } from '../lib/search'
import { describeZone, formatDifference } from '../lib/time'
import { useStore } from '../store'

interface Props {
  now: Date
  mode: 'base' | 'select'
  onClose: () => void
  onPick: (timezone: string, cityId?: string) => void
}

/** Shown before the user types: the highest-priority cities. */
const SUGGESTED = CITIES.filter((c) => c.priority === 1).slice(0, 12)

export const SearchPicker = memo(function SearchPicker({ now, mode, onClose, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const baseTimezone = useStore((s) => s.baseTimezone)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(
    () => (query.trim() ? searchTimezones(query, now) : []),
    [query, now],
  )

  useEffect(() => {
    setCursor(0)
    setExpanded(null)
  }, [query])

  const rows: SearchResult[] = query.trim()
    ? results
    : SUGGESTED.map((c) => ({
        kind: 'city' as const,
        id: `city:${c.id}`,
        timezone: c.timezone,
        titleZh: c.nameZh,
        titleEn: c.nameEn,
        subtitleZh: c.countryZh,
        aliases: c.aliases,
        priority: c.priority,
        cityId: c.id,
        score: 0,
      }))

  const commit = (r: SearchResult) => {
    // Ambiguous entries expand instead of silently choosing (§35).
    if (r.candidates && r.candidates.length > 1) {
      setExpanded((prev) => (prev === r.id ? null : r.id))
      return
    }
    onPick(r.candidates?.[0]?.timezone ?? r.timezone, r.cityId)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.max(0, Math.min(c + 1, rows.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = rows[cursor]
      if (r) commit(r)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="picker" role="dialog" aria-modal="true" aria-label="搜索时区">
        <div className="picker-input">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
          <input
            ref={inputRef}
            id="tz-search"
            name="tz-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="城市 / 国家 / Europe/London / UTC+8 / CST"
            aria-label="搜索城市或时区"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="picker-hint">{mode === 'base' ? '设为基准' : '选择对比'}</span>
        </div>

        <div className="picker-list" ref={listRef}>
          {!query.trim() && <div className="picker-section">常用城市</div>}

          {rows.map((r, i) => {
            const info = describeZone(r.timezone, now, baseTimezone)
            const isExpanded = expanded === r.id
            const ambiguous = (r.candidates?.length ?? 0) > 1
            return (
              <div key={r.id} className="picker-group">
                <button
                  className={`picker-row${i === cursor ? ' is-cursor' : ''}`}
                  data-cursor={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(r)}
                  aria-expanded={ambiguous ? isExpanded : undefined}
                >
                  <span className="pr-main">
                    <span className="pr-title">
                      {r.titleZh}
                      {r.kind === 'abbr' && <span className="pr-kind">时区</span>}
                      {ambiguous && (
                        <span className="pr-ambig">{r.candidates!.length} 种含义</span>
                      )}
                    </span>
                    <span className="pr-sub">
                      {r.subtitleZh}
                      {r.kind === 'city' && ` · ${r.timezone}`}
                    </span>
                  </span>
                  {!ambiguous && (
                    <span className="pr-right">
                      <span className="pr-time tnum">{info.localTime}</span>
                      <span className="pr-meta tnum">
                        {info.abbreviation} · {info.utcOffset}
                      </span>
                    </span>
                  )}
                  {ambiguous && (
                    <svg className={`chev${isExpanded ? ' up' : ''}`} viewBox="0 0 12 12">
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  )}
                </button>

                {ambiguous && isExpanded && (
                  <div className="picker-cands">
                    {r.candidates!.map((c) => {
                      const ci = describeZone(c.timezone, now, baseTimezone)
                      return (
                        <button
                          key={c.timezone}
                          className="picker-cand"
                          onClick={() => onPick(c.timezone)}
                        >
                          <span className="pc-label">{c.labelZh}</span>
                          <span className="pc-zone tnum">{c.timezone}</span>
                          <span className="pc-right tnum">
                            {ci.localTime}
                            <em>
                              {ci.abbreviation} · {ci.utcOffset}
                            </em>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {query.trim() && rows.length === 0 && (
            <div className="picker-empty">
              <p>没有找到相关城市或时区</p>
              <span>试试城市名称、国家、IANA 名称（Asia/Shanghai）、UTC+8 或 PST</span>
            </div>
          )}
        </div>

        <div className="picker-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>Enter</kbd> 确认
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
          {query.trim() && rows[cursor] && (
            <span className="picker-foot-diff">
              {formatDifference(
                describeZone(rows[cursor]!.timezone, now, baseTimezone).differenceMinutes,
                '基准',
              )}
            </span>
          )}
        </div>
      </div>
    </>
  )
})
