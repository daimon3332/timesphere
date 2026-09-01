import { useCallback, useEffect, useMemo } from 'react'
import { CityGrid } from './components/CityGrid'
import { CountryZonePicker } from './components/CountryZonePicker'
import { DetailPanel } from './components/DetailPanel'
import { Header } from './components/Header'
import { WorldMap } from './components/WorldMap'
import { useNow } from './hooks/useNow'
import { CITY_BY_ZONE } from './lib/search'
import { describeZone, isValidTimeZone } from './lib/time'
import { useStore } from './store'

export default function App() {
  const now = useNow()
  const baseTimezone = useStore((s) => s.baseTimezone)
  const selectedTimezone = useStore((s) => s.selectedTimezone)
  const clickPosition = useStore((s) => s.clickPosition)
  const select = useStore((s) => s.select)
  const setBase = useStore((s) => s.setBase)
  const closeCountryPicker = useStore((s) => s.closeCountryPicker)
  const setSearchOpen = useStore((s) => s.setSearchOpen)

  // §68: if the platform cannot resolve the base zone, say so instead of
  // rendering a wrong time.
  const baseOk = useMemo(() => isValidTimeZone(baseTimezone), [baseTimezone])

  const baseInfo = useMemo(
    () => (baseOk ? describeZone(baseTimezone, now, baseTimezone) : null),
    [baseOk, baseTimezone, now],
  )

  const handleSelect = useCallback(
    (timezone: string, cityId?: string | null, clickPos?: { x: number; y: number } | null) => {
      select(timezone, cityId ?? CITY_BY_ZONE.get(timezone)?.id ?? null, clickPos ?? null)
    },
    [select],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCountryPicker()
        select(null)
      }
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        const el = document.activeElement
        if (el instanceof HTMLInputElement) return
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCountryPicker, select, setSearchOpen])

  if (!baseOk || !baseInfo) {
    return (
      <div className="fatal">
        <p>无法获取当前时区信息</p>
        <button onClick={() => setBase('UTC')}>改用 UTC</button>
      </div>
    )
  }

  return (
    <div className="app">
      <Header now={now} baseInfo={baseInfo} onSelect={handleSelect} />
      <main className="main">
        <CityGrid now={now} onSelect={handleSelect} />
        <section className="map-section">
          <WorldMap now={now} onSelect={handleSelect} />
          {selectedTimezone && (
            <DetailPanel now={now} timezone={selectedTimezone} onClose={() => select(null)} clickPosition={clickPosition} />
          )}
          <CountryZonePicker now={now} onSelect={handleSelect} />
        </section>
      </main>
    </div>
  )
}
