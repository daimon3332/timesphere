import { lookupAbbr, type AbbrEntry } from '../data/abbr-glossary'
import { chineseZoneName, englishZoneName, zoneNaming, offsetMinutes } from './time'

export interface ZoneName {
  abbr: string
  offset: number
  /** a real letter abbreviation, not a GMT±x stand-in */
  lettered: boolean
  nameZh: string
  nameEn: string
  regionZh?: string
  periodZh?: string
  entry: AbbrEntry | null
}

const isOffsetStandIn = (abbr: string) => /^(GMT|UTC)[+-]/.test(abbr)

/** Explain one abbreviation as used by `timeZone` at `instant`. */
export function explainAbbr(timeZone: string, abbr: string, offset: number, instant: Date): ZoneName {
  const entry = lookupAbbr(abbr, offset)
  return {
    abbr,
    offset,
    lettered: !isOffsetStandIn(abbr),
    nameZh: entry?.nameZh ?? chineseZoneName(timeZone, instant),
    nameEn: entry?.nameEn ?? englishZoneName(timeZone, instant),
    regionZh: entry?.regionZh,
    periodZh: entry?.periodZh,
    entry,
  }
}

const MONTH = 30.5 * 86_400_000
const HOUR = 3_600_000
const namesCache = new Map<string, ZoneName[]>()
let cacheHour = 0

/** Every name the zone will use in the coming twelve months, lowest offset first. */
export function upcomingZoneNames(timeZone: string, instant: Date): ZoneName[] {
  const hour = Math.floor(instant.getTime() / HOUR)
  if (hour !== cacheHour) {
    namesCache.clear()
    cacheHour = hour
  }
  const key = timeZone
  const hit = namesCache.get(key)
  if (hit) return hit
  const seen = new Map<string, ZoneName>()
  for (let i = 0; i <= 12; i++) {
    const at = new Date(instant.getTime() + i * MONTH)
    const abbr = zoneNaming(timeZone, at).abbreviation
    const offset = offsetMinutes(timeZone, at)
    const k = `${abbr}|${offset}`
    if (!seen.has(k)) seen.set(k, explainAbbr(timeZone, abbr, offset, at))
  }
  const names = [...seen.values()].sort((a, b) => a.offset - b.offset)
  namesCache.set(key, names)
  return names
}
