import { memo, useEffect, useRef, useState } from 'react'
import { TZ_GROUPS } from '../data/tz-groups'
import { CITY_BY_ZONE } from '../lib/search'
import { formatOffset, offsetMinutes } from '../lib/time'

interface Props {
  now: Date
  onSelect: (timezone: string, cityId?: string | null) => void
}

/** §10: shortcut list. Ambiguous ones drill in instead of guessing. */
const TAGS: { label: string; nameZh: string; code: string }[] = [
  { label: 'UTC', nameZh: '协调世界时', code: 'UTC' },
  { label: 'GMT', nameZh: '格林尼治标准时间', code: 'GMT' },
  { label: 'PST/PDT', nameZh: '美西（太平洋）时间', code: 'PST' },
  { label: 'MST/MDT', nameZh: '美国山地时间', code: 'MST' },
  { label: 'CST/CDT', nameZh: '美国中部时间', code: 'CST-US' },
  { label: 'EST/EDT', nameZh: '美东时间', code: 'EST' },
  { label: 'CET/CEST', nameZh: '欧洲中部时间', code: 'CET' },
  { label: 'IST', nameZh: '印度 / 以色列 / 爱尔兰', code: 'IST' },
  { label: 'JST', nameZh: '日本标准时间', code: 'JST' },
  { label: 'KST', nameZh: '韩国标准时间', code: 'KST' },
  { label: 'AEST/AEDT', nameZh: '澳大利亚东部时间', code: 'AEST' },
]

export const QuickTags = memo(function QuickTags({ now, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [groupCode, setGroupCode] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const close = (refocus = true) => {
    setOpen(false)
    setGroupCode(null)
    if (refocus) trigger.current?.focus()
  }

  // Move focus into the menu whenever it opens or changes level.
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open, groupCode])

  const pick = (timezone: string) => {
    onSelect(timezone, CITY_BY_ZONE.get(timezone)?.id ?? null)
    close(false)
  }

  const choose = (code: string) => {
    const group = TZ_GROUPS.find((g) => g.code === code)
    if (!group) return
    if (group.zones.length === 1) pick(group.zones[0]!.timezone)
    else setGroupCode(code)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (groupCode) setGroupCode(null)
      else close()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const group = groupCode ? TZ_GROUPS.find((g) => g.code === groupCode) : null
  const live = (tz: string) => formatOffset(offsetMinutes(tz, now))

  return (
    <div className="quick-tags-wrap">
      <button
        ref={trigger}
        className={`qt-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        常用时区
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="tag-scrim" onClick={() => close(false)} />
          <div className="qt-pop" role="menu" aria-label="常用时区" ref={menu} onKeyDown={onKeyDown}>
            {group ? (
              <>
                <button role="menuitem" className="qt-back" onClick={() => setGroupCode(null)}>
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M7.5 3L4.5 6L7.5 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  {group.titleZh}
                  <span>{group.zones.length} 个地区</span>
                </button>
                {group.zones.map((z) => (
                  <button key={z.timezone} role="menuitem" className="qt-row is-zone" onClick={() => pick(z.timezone)}>
                    <span className="qt-name">{z.labelZh}</span>
                    <span className="qt-off tnum">{live(z.timezone)}</span>
                    <span className="qt-sub">{z.citiesZh}</span>
                  </button>
                ))}
              </>
            ) : (
              TAGS.map((t) => {
                const g = TZ_GROUPS.find((x) => x.code === t.code)
                if (!g) return null
                const multi = g.zones.length > 1
                return (
                  <button key={t.code} role="menuitem" className="qt-row" onClick={() => choose(t.code)}>
                    <b className="qt-abbr tnum">{t.label}</b>
                    <span className="qt-name">{t.nameZh}</span>
                    <span className="qt-off tnum">
                      {multi ? `${g.zones.length} 个地区` : live(g.zones[0]!.timezone)}
                      {multi && (
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M4.5 3L7.5 6L4.5 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
})
