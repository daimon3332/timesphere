import { memo, useState } from 'react'
import { TZ_GROUPS } from '../data/tz-groups'
import { CITY_BY_ZONE } from '../lib/search'

interface Props {
  onSelect: (timezone: string, cityId?: string | null) => void
}

/** §10: small shortcut tags. Ambiguous ones expand instead of guessing. */
const TAGS: { label: string; code: string }[] = [
  { label: 'UTC', code: 'UTC' },
  { label: 'GMT', code: 'GMT' },
  { label: 'PST/PDT', code: 'PST' },
  { label: 'EST/EDT', code: 'EST' },
  { label: 'CST/CDT', code: 'CST-US' },
  { label: 'MST/MDT', code: 'MST' },
  { label: 'CET/CEST', code: 'CET' },
  { label: 'JST', code: 'JST' },
  { label: 'KST', code: 'KST' },
]

export const QuickTags = memo(function QuickTags({ onSelect }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  const handle = (code: string) => {
    const group = TZ_GROUPS.find((g) => g.code === code)
    if (!group) return
    if (group.zones.length === 1) {
      const tz = group.zones[0]!.timezone
      onSelect(tz, CITY_BY_ZONE.get(tz)?.id ?? null)
      setOpen(null)
      return
    }
    setOpen((prev) => (prev === code ? null : code))
  }

  const openGroup = open ? TZ_GROUPS.find((g) => g.code === open) : null

  return (
    <div className="quick-tags-wrap">
      <div className="quick-tags" role="group" aria-label="常用时区快捷标签">
        {TAGS.map((t) => (
          <button
            key={t.code}
            className={`tag${open === t.code ? ' is-open' : ''}`}
            onClick={() => handle(t.code)}
            aria-expanded={open === t.code}
          >
            {t.label}
          </button>
        ))}
      </div>

      {openGroup && (
        <>
          <div className="tag-scrim" onClick={() => setOpen(null)} />
          <div className="tag-pop" role="dialog" aria-label={openGroup.titleZh}>
            <div className="tag-pop-head">
              <strong>{openGroup.titleZh}</strong>
              <span>{openGroup.zones.length} 个可选地区</span>
            </div>
            {openGroup.zones.map((z) => (
              <button
                key={z.timezone}
                className="tag-pop-row"
                onClick={() => {
                  onSelect(z.timezone, CITY_BY_ZONE.get(z.timezone)?.id ?? null)
                  setOpen(null)
                }}
              >
                <span className="tp-label">{z.labelZh}</span>
                <span className="tp-cities">{z.citiesZh}</span>
                <span className="tp-zone tnum">{z.timezone}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})
