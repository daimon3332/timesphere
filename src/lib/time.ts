import type { CityTimeInfo, DayRelation } from '../types'

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface ZoneParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function utcTimestamp(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, 0)
  return date.getTime()
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsCache.set(timeZone, f)
  }
  return f
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Decompose an instant into wall-clock fields of an IANA zone. */
export function zonedParts(timeZone: string, instant: Date): ZoneParts {
  const raw: Record<string, string> = {}
  for (const p of partsFormatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') raw[p.type] = p.value
  }
  // ICU renders midnight as hour 24 in some locales/zones.
  const hour = Number(raw.hour) % 24
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour,
    minute: Number(raw.minute),
    second: Number(raw.second),
    weekday: WEEKDAY_INDEX[raw.weekday] ?? 0,
  }
}

/**
 * Real UTC offset of a zone at an instant, in minutes.
 * Derived from wall-clock fields, so DST is handled by the platform tzdata.
 */
export function offsetMinutes(timeZone: string, instant: Date): number {
  const p = zonedParts(timeZone, instant)
  const asUTC = utcTimestamp(p.year, p.month, p.day, p.hour, p.minute, p.second)
  // Drop sub-second noise so the result lands on a whole minute.
  const base = Math.floor(instant.getTime() / 1000) * 1000
  return Math.round((asUTC - base) / 60000)
}

/** UTC+8 / UTC+5:30 / UTC-3:30 / UTC */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'UTC'
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`
}

/** GMT+8 style, used where a GMT-flavoured label reads better. */
export function formatGmtOffset(minutes: number): string {
  return formatOffset(minutes).replace('UTC', 'GMT')
}

const longNameCache = new Map<string, Intl.DateTimeFormat>()

function longName(timeZone: string, instant: Date): string {
  let f = longNameCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'long' })
    longNameCache.set(timeZone, f)
  }
  const part = f.formatToParts(instant).find((p) => p.type === 'timeZoneName')
  return part?.value ?? ''
}

function shortName(timeZone: string, instant: Date): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? ''
}

/**
 * Zones where DST cannot be inferred reliably, keyed by actual offset minutes.
 *
 * These must not go through the [standard, daylight] table, because their
 * tzdata semantics defeat every DST heuristic:
 *   - Europe/Dublin models winter as *negative* DST, so CLDR reports
 *     "Irish Standard Time" in summer and isDST is false year-round. Keying
 *     off isDST would print "GMT" at UTC+1.
 *   - Africa/Casablanca sits on UTC+1 permanently and steps *back* to UTC+0
 *     for Ramadan, inverting the usual standard/summer relationship.
 *   - Antarctica/Troll has no CLDR letter name at all.
 * Offset is always exact, so it is the only trustworthy key here.
 */
const ABBR_BY_OFFSET: Record<string, Record<number, string>> = {
  'Europe/Dublin': { 0: 'GMT', 60: 'IST' },
  'Africa/Casablanca': { 0: 'WET', 60: 'WEST' },
  'Antarctica/Troll': { 0: 'GMT', 120: 'CEST' },
}

/**
 * Curated abbreviations. CLDR only emits real letter abbreviations for a
 * handful of zones (PDT/EDT/CDT); everything else degrades to "GMT+8".
 * Keys are zone ids; values are [standard, daylight].
 */
const ABBR: Record<string, [string, string]> = {
  'Asia/Shanghai': ['CST', 'CST'],
  'Asia/Chongqing': ['CST', 'CST'],
  'Asia/Harbin': ['CST', 'CST'],
  'Asia/Macau': ['CST', 'CST'],
  'Asia/Hong_Kong': ['HKT', 'HKT'],
  'Asia/Taipei': ['CST', 'CST'],
  'Asia/Urumqi': ['XJT', 'XJT'],
  'Asia/Tokyo': ['JST', 'JST'],
  'Asia/Seoul': ['KST', 'KST'],
  'Asia/Pyongyang': ['KST', 'KST'],
  'Asia/Singapore': ['SGT', 'SGT'],
  'Asia/Kuala_Lumpur': ['MYT', 'MYT'],
  'Asia/Jakarta': ['WIB', 'WIB'],
  'Asia/Makassar': ['WITA', 'WITA'],
  'Asia/Jayapura': ['WIT', 'WIT'],
  'Asia/Bangkok': ['ICT', 'ICT'],
  'Asia/Ho_Chi_Minh': ['ICT', 'ICT'],
  'Asia/Manila': ['PST', 'PST'],
  'Asia/Kolkata': ['IST', 'IST'],
  'Asia/Colombo': ['IST', 'IST'],
  'Asia/Kathmandu': ['NPT', 'NPT'],
  'Asia/Dhaka': ['BST', 'BST'],
  'Asia/Karachi': ['PKT', 'PKT'],
  'Asia/Kabul': ['AFT', 'AFT'],
  'Asia/Tehran': ['IRST', 'IRDT'],
  'Asia/Dubai': ['GST', 'GST'],
  'Asia/Muscat': ['GST', 'GST'],
  'Asia/Riyadh': ['AST', 'AST'],
  'Asia/Qatar': ['AST', 'AST'],
  'Asia/Kuwait': ['AST', 'AST'],
  'Asia/Baghdad': ['AST', 'AST'],
  'Asia/Jerusalem': ['IST', 'IDT'],
  'Asia/Yangon': ['MMT', 'MMT'],
  'Asia/Yekaterinburg': ['YEKT', 'YEKT'],
  'Asia/Novosibirsk': ['NOVT', 'NOVT'],
  'Asia/Krasnoyarsk': ['KRAT', 'KRAT'],
  'Asia/Irkutsk': ['IRKT', 'IRKT'],
  'Asia/Yakutsk': ['YAKT', 'YAKT'],
  'Asia/Vladivostok': ['VLAT', 'VLAT'],
  'Asia/Magadan': ['MAGT', 'MAGT'],
  'Asia/Kamchatka': ['PETT', 'PETT'],
  'Europe/London': ['GMT', 'BST'],
  'Europe/Dublin': ['GMT', 'IST'],
  'Europe/Lisbon': ['WET', 'WEST'],
  'Atlantic/Canary': ['WET', 'WEST'],
  'Europe/Paris': ['CET', 'CEST'],
  'Europe/Berlin': ['CET', 'CEST'],
  'Europe/Amsterdam': ['CET', 'CEST'],
  'Europe/Brussels': ['CET', 'CEST'],
  'Europe/Madrid': ['CET', 'CEST'],
  'Europe/Rome': ['CET', 'CEST'],
  'Europe/Zurich': ['CET', 'CEST'],
  'Europe/Vienna': ['CET', 'CEST'],
  'Europe/Prague': ['CET', 'CEST'],
  'Europe/Warsaw': ['CET', 'CEST'],
  'Europe/Stockholm': ['CET', 'CEST'],
  'Europe/Oslo': ['CET', 'CEST'],
  'Europe/Copenhagen': ['CET', 'CEST'],
  'Europe/Budapest': ['CET', 'CEST'],
  'Europe/Athens': ['EET', 'EEST'],
  'Europe/Helsinki': ['EET', 'EEST'],
  'Europe/Kyiv': ['EET', 'EEST'],
  'Europe/Bucharest': ['EET', 'EEST'],
  'Europe/Istanbul': ['TRT', 'TRT'],
  'Europe/Moscow': ['MSK', 'MSK'],
  'Africa/Cairo': ['EET', 'EEST'],
  'Africa/Johannesburg': ['SAST', 'SAST'],
  'Africa/Lagos': ['WAT', 'WAT'],
  'Africa/Nairobi': ['EAT', 'EAT'],
  'Africa/Casablanca': ['WEST', 'WET'],
  'Africa/Accra': ['GMT', 'GMT'],
  'America/New_York': ['EST', 'EDT'],
  'America/Toronto': ['EST', 'EDT'],
  'America/Detroit': ['EST', 'EDT'],
  'America/Chicago': ['CST', 'CDT'],
  'America/Winnipeg': ['CST', 'CDT'],
  'America/Mexico_City': ['CST', 'CST'],
  'America/Denver': ['MST', 'MDT'],
  'America/Edmonton': ['MST', 'MDT'],
  'America/Phoenix': ['MST', 'MST'],
  'America/Los_Angeles': ['PST', 'PDT'],
  'America/Vancouver': ['PST', 'PDT'],
  'America/Anchorage': ['AKST', 'AKDT'],
  'Pacific/Honolulu': ['HST', 'HST'],
  'America/Halifax': ['AST', 'ADT'],
  'America/St_Johns': ['NST', 'NDT'],
  'America/Sao_Paulo': ['BRT', 'BRST'],
  'America/Argentina/Buenos_Aires': ['ART', 'ART'],
  'America/Santiago': ['CLT', 'CLST'],
  'America/Bogota': ['COT', 'COT'],
  'America/Lima': ['PET', 'PET'],
  'America/Caracas': ['VET', 'VET'],
  'Australia/Sydney': ['AEST', 'AEDT'],
  'Australia/Melbourne': ['AEST', 'AEDT'],
  'Australia/Hobart': ['AEST', 'AEDT'],
  'Australia/Brisbane': ['AEST', 'AEST'],
  'Australia/Adelaide': ['ACST', 'ACDT'],
  'Australia/Darwin': ['ACST', 'ACST'],
  'Australia/Perth': ['AWST', 'AWST'],
  'Pacific/Auckland': ['NZST', 'NZDT'],
  'Pacific/Fiji': ['FJT', 'FJST'],
  UTC: ['UTC', 'UTC'],
  'Etc/UTC': ['UTC', 'UTC'],
  'Etc/GMT': ['GMT', 'GMT'],
}

/** Initials of a CLDR long name: "China Standard Time" -> CST */
function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w))
  if (words.length < 2) return ''
  return words.map((w) => w[0]!.toUpperCase()).join('')
}

const yearOffsetCache = new Map<string, { min: number; max: number; minMonths: number }>()

/** Sample a zone across a year to learn its offset range and which offset dominates. */
function yearProfile(timeZone: string, year: number) {
  const key = `${timeZone}|${year}`
  let hit = yearOffsetCache.get(key)
  if (hit) return hit
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  const samples: number[] = []
  for (let m = 0; m < 12; m++) {
    const o = offsetMinutes(timeZone, new Date(utcTimestamp(year, m + 1, 15, 12)))
    samples.push(o)
    if (o < min) min = o
    if (o > max) max = o
  }
  const minMonths = samples.filter((o) => o === min).length
  hit = { min, max, minMonths }
  yearOffsetCache.set(key, hit)
  return hit
}

export interface ZoneNaming {
  abbreviation: string
  isDST: boolean
  longName: string
}

/**
 * Resolve abbreviation + DST state.
 *
 * DST is decided by CLDR's long name first ("Summer"/"Daylight" is
 * authoritative and correct for London, Los Angeles, Sydney, Gaza...).
 * Zones CLDR renders as a bare "GMT+02:00" (Antarctica/Troll,
 * Africa/Casablanca) fall back to comparing the current offset against the
 * offset that dominates the year.
 */
export function zoneNaming(timeZone: string, instant: Date): ZoneNaming {
  const long = longName(timeZone, instant)
  const isDaylightName = /\b(Summer|Daylight)\b/.test(long)
  const isBareOffset = /^GMT([+-]|$)/.test(long) || long === ''

  let isDST: boolean
  if (isDaylightName) {
    isDST = true
  } else if (isBareOffset) {
    const off = offsetMinutes(timeZone, instant)
    const { min, max, minMonths } = yearProfile(timeZone, zonedParts(timeZone, instant).year)
    // The offset held for the larger part of the year is standard time.
    const standard = minMonths >= 6 ? min : max
    isDST = max !== min && off > standard
  } else {
    isDST = false
  }

  const off = offsetMinutes(timeZone, instant)
  const byOffset = ABBR_BY_OFFSET[timeZone]
  const curated = ABBR[timeZone]
  let abbreviation: string
  if (byOffset?.[off]) {
    // Offset is exact even where DST detection is not.
    abbreviation = byOffset[off]
  } else if (curated) {
    abbreviation = isDST ? curated[1] : curated[0]
  } else {
    const short = shortName(timeZone, instant)
    if (/^[A-Z]{2,5}$/.test(short)) {
      abbreviation = short
    } else {
      abbreviation = initials(long) || formatGmtOffset(off)
    }
  }
  return { abbreviation, isDST, longName: long }
}

/** Compare two zones' calendar days at the same instant. */
function dayRelation(basePartsDay: number[], targetPartsDay: number[]): DayRelation {
  const a = utcTimestamp(basePartsDay[0]!, basePartsDay[1]!, basePartsDay[2]!)
  const b = utcTimestamp(targetPartsDay[0]!, targetPartsDay[1]!, targetPartsDay[2]!)
  if (b === a) return 'today'
  return b > a ? 'tomorrow' : 'yesterday'
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Everything the UI needs about one zone at one instant, relative to a base zone.
 * differenceMinutes is computed from the two real offsets at this instant,
 * never from static offsets, so DST on either side is respected.
 */
export function describeZone(
  timeZone: string,
  instant: Date,
  baseTimeZone: string,
): CityTimeInfo {
  const p = zonedParts(timeZone, instant)
  const off = offsetMinutes(timeZone, instant)
  const baseOff = offsetMinutes(baseTimeZone, instant)
  const basePart = zonedParts(baseTimeZone, instant)
  const { abbreviation, isDST } = zoneNaming(timeZone, instant)

  return {
    timezone: timeZone,
    localTime: `${pad(p.hour)}:${pad(p.minute)}`,
    seconds: pad(p.second),
    date: `${String(p.year).padStart(4, '0')}-${pad(p.month)}-${pad(p.day)}`,
    shortDate: `${pad(p.month)}-${pad(p.day)}`,
    weekday: WEEKDAY_ZH[p.weekday]!,
    utcOffset: formatOffset(off),
    offsetMinutes: off,
    abbreviation,
    isDST,
    differenceMinutes: off - baseOff,
    dayRelation: dayRelation(
      [basePart.year, basePart.month, basePart.day],
      [p.year, p.month, p.day],
    ),
  }
}

/**
 * Human-readable difference. Supports fractional zones (+5:45, -3:30) and
 * never leaks the day rollover into the number — 快/慢 is pure offset delta.
 */
export function formatDifference(minutes: number, baseLabel: string): string {
  if (minutes === 0) return `与${baseLabel}相同`
  const ahead = minutes > 0
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} 小时`)
  if (m > 0) parts.push(`${m} 分`)
  return `${ahead ? '快' : '慢'} ${parts.join(' ')}`
}

/** Compact form for dense city cards: +8:00 / -7:30 / 基准 */
export function formatDifferenceShort(minutes: number): string {
  if (minutes === 0) return '同步'
  const sign = minutes > 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h${m}m`
}

export const DAY_RELATION_ZH: Record<DayRelation, string> = {
  yesterday: '昨天',
  today: '今天',
  tomorrow: '明天',
}

export type WallClockResolution = 'exact' | 'gap' | 'ambiguous'

export interface ResolvedWallClock {
  instant: Date
  /**
   * `gap`     — the requested local time does not exist (spring forward);
   *             the instant is shifted forward past the gap.
   * `ambiguous` — it occurs twice (fall back); the earlier one is used.
   */
  resolution: WallClockResolution
}

/**
 * Build an instant from wall-clock fields interpreted in a given zone.
 *
 * DST transitions make this genuinely ambiguous, and a naive
 * subtract-the-offset loop oscillates: for a non-existent local time it can
 * land an hour *before* what was asked (America/New_York 02:30 on a spring
 * forward date) or an hour *after* (Europe/London 01:30), depending on which
 * side the second pass samples. Both are silently wrong.
 *
 * So each candidate is verified by rendering it back. If neither candidate
 * reproduces the requested wall clock, the time falls in a gap and is shifted
 * forward past it — matching Temporal/java.time "compatible" behaviour — and
 * the caller is told, so the UI can say the time was adjusted.
 */
export function resolveZonedWallClock(
  timeZone: string,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): ResolvedWallClock {
  const target = utcTimestamp(y, mo, d, h, mi)
  const calendar = new Date(target)
  if (![y, mo, d, h, mi].every(Number.isInteger) || y < 1 || y > 9999 ||
    calendar.getUTCFullYear() !== y || calendar.getUTCMonth() + 1 !== mo ||
    calendar.getUTCDate() !== d || calendar.getUTCHours() !== h || calendar.getUTCMinutes() !== mi) {
    throw new RangeError('Invalid wall-clock fields')
  }

  const renders = (ts: number) => {
    const p = zonedParts(timeZone, new Date(ts))
    return (
      p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi
    )
  }

  // Offsets on either side of a possible transition near this local time.
  const offBefore = offsetMinutes(timeZone, new Date(target - 86400000))
  const offAfter = offsetMinutes(timeZone, new Date(target + 86400000))

  const candidates = [target - offBefore * 60000, target - offAfter * 60000]
  const valid = candidates.filter(renders)

  if (valid.length) {
    // Ambiguous local times resolve to the earlier instant (first pass of the
    // clock), which is what a person means by "01:30" on a fall-back night.
    const instant = new Date(Math.min(...valid))
    return {
      instant,
      resolution: valid.length > 1 && candidates[0] !== candidates[1] ? 'ambiguous' : 'exact',
    }
  }

  // Gap: no instant renders this local time. Take the *later* candidate so the
  // result lands after the gap (02:30 -> 03:30), never before it (01:30).
  const forward = Math.max(candidates[0]!, candidates[1]!)
  return { instant: new Date(forward), resolution: 'gap' }
}

/** Back-compat wrapper for callers that do not care about DST edge cases. */
export function instantFromZonedWallClock(
  timeZone: string,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): Date {
  return resolveZonedWallClock(timeZone, y, mo, d, h, mi).instant
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}
