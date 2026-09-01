export type Region =
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'middle-east'
  | 'africa'
  | 'oceania'

export interface City {
  id: string
  nameZh: string
  nameEn: string
  countryZh: string
  countryEn: string
  countryCode: string
  timezone: string
  latitude: number
  longitude: number
  aliases: string[]
  /** 1 = global tier (always on map), 2 = regional, 3 = local */
  priority: 1 | 2 | 3
  region: Region
}

export type DayRelation = 'yesterday' | 'today' | 'tomorrow'

export interface CityTimeInfo {
  timezone: string
  /** HH:mm */
  localTime: string
  /** ss */
  seconds: string
  /** YYYY-MM-DD */
  date: string
  /** MM-DD */
  shortDate: string
  weekday: string
  /** e.g. UTC+8, UTC+5:30, UTC-3:30 */
  utcOffset: string
  offsetMinutes: number
  abbreviation: string
  isDST: boolean
  /** target offset minus base offset, in minutes */
  differenceMinutes: number
  dayRelation: DayRelation
}

export type DisplayMode = 'iana' | 'utc' | 'abbreviation'
export type ClockMode = 'now' | 'custom'

/** A searchable timezone concept: a city, an IANA zone, or an abbreviation group. */
export type TzEntryKind = 'city' | 'zone' | 'abbr' | 'offset'

export interface TzSearchEntry {
  kind: TzEntryKind
  /** stable key */
  id: string
  timezone: string
  /** primary label, e.g. 上海 / 美国太平洋时间 */
  titleZh: string
  titleEn: string
  /** secondary line, e.g. 中国 or 洛杉矶 / 旧金山 / 西雅图 */
  subtitleZh: string
  /** candidate zones when an abbreviation is ambiguous (CST) */
  candidates?: { timezone: string; labelZh: string; labelEn: string }[]
  aliases: string[]
  priority: number
  cityId?: string
}

export interface CountryZoneOption {
  timezone: string
  labelZh: string
  labelEn: string
  citiesZh: string
  cityId?: string
}

export interface CountryInfo {
  code: string
  nameZh: string
  nameEn: string
  zones: CountryZoneOption[]
}
