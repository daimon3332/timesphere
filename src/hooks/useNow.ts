import { useEffect, useState } from 'react'
import { useStore } from '../store'

/**
 * One ticker for the whole page (spec §66). Every card derives its time from
 * this instant instead of owning a timer.
 */
export function useNow(): Date {
  const mode = useStore((s) => s.mode)
  const custom = useStore((s) => s.customDateTime)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (mode === 'custom') return
    // Align to the next whole second so the seconds digit flips cleanly.
    let interval: number | undefined
    const start = window.setTimeout(
      () => {
        setNow(new Date())
        interval = window.setInterval(() => setNow(new Date()), 1000)
      },
      1000 - (Date.now() % 1000),
    )
    return () => {
      window.clearTimeout(start)
      if (interval) window.clearInterval(interval)
    }
  }, [mode])

  return mode === 'custom' && custom ? custom : now
}
