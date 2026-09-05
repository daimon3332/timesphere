import { memo } from 'react'
import { COUNTRY_BY_CODE } from '../data/countries'
import { describeZone, formatDifference } from '../lib/time'
import { useStore } from '../store'
import { zoneLabel } from '../lib/search'

interface Props {
  /** Shared page instant — §66 allows exactly one ticker for the whole app. */
  now: Date
  onSelect: (timezone: string, cityId?: string | null) => void
}

/** §26: a country with several zones must ask which one, never assume. */
export const CountryZonePicker = memo(function CountryZonePicker({ now, onSelect }: Props) {
  const picker = useStore((s) => s.countryPicker)
  const close = useStore((s) => s.closeCountryPicker)
  const baseTimezone = useStore((s) => s.baseTimezone)
  const baseCityId = useStore((s) => s.baseCityId)

  if (!picker) return null
  const info = COUNTRY_BY_CODE.get(picker.code)
  if (!info) return null
  const baseName = zoneLabel(baseTimezone, now, baseCityId).titleZh

  return (
    <>
      <div className="scrim soft" onClick={close} />
      <div className="cz-picker" role="dialog" aria-modal="true" aria-label={`${info.nameZh} 时区选择`}>
        <div className="cz-head">
          <div>
            <strong>{info.nameZh}</strong>
            <span>{info.zones.length} 个主要时区，请选择地区</span>
          </div>
          <button onClick={close} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="cz-list">
          {info.zones.map((z) => {
            const d = describeZone(z.timezone, now, baseTimezone)
            return (
              <button
                key={z.timezone}
                className="cz-row"
                onClick={() => {
                  onSelect(z.timezone, z.cityId ?? null)
                  close()
                }}
              >
                <span className="cz-main">
                  <span className="cz-label">{z.labelZh}</span>
                  <span className="cz-cities">{z.citiesZh}</span>
                  <span className="cz-zone tnum">{z.timezone}</span>
                </span>
                <span className="cz-right">
                  <span className="cz-time tnum">{d.localTime}</span>
                  <span className="cz-meta tnum">
                    {d.abbreviation} · {d.utcOffset}
                  </span>
                  <span
                    className={`cz-diff ${
                      d.differenceMinutes === 0 ? 'same' : d.differenceMinutes > 0 ? 'ahead' : 'behind'
                    }`}
                  >
                    {formatDifference(d.differenceMinutes, baseName)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
})
