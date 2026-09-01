import { CITIES } from '../data/cities'
import { COUNTRIES } from '../data/countries'
import { TZ_GROUPS } from '../data/tz-groups'
import type { City, TzSearchEntry } from '../types'
import { formatOffset, isValidTimeZone, offsetMinutes } from './time'

/** Collapsed form: powers exact and prefix matching ("hongkong"). */
const norm = (s: string) => s.toLowerCase().replace(/[\s_·]/g, '')

/**
 * Space-preserving form: powers substring matching. Collapsing spaces would
 * invent matches across word boundaries — "Pacific Standard Time" becomes
 * "pacificstandardtime", which contains "cst" and would wrongly answer a
 * search for CST.
 */
const loose = (s: string) => s.toLowerCase().replace(/[_·]/g, ' ')

interface Indexed {
  entry: TzSearchEntry
  tokens: string[]
  looseTokens: string[]
}

function cityEntry(c: City): TzSearchEntry {
  return {
    kind: 'city',
    id: `city:${c.id}`,
    timezone: c.timezone,
    titleZh: c.nameZh,
    titleEn: c.nameEn,
    subtitleZh: c.countryZh,
    aliases: c.aliases,
    priority: c.priority,
    cityId: c.id,
  }
}

const INDEX: Indexed[] = []

for (const c of CITIES) {
  INDEX.push({
    entry: cityEntry(c),
    tokens: c.aliases.map(norm),
    looseTokens: c.aliases.map(loose),
  })
}

for (const g of TZ_GROUPS) {
  INDEX.push({
    entry: {
      kind: 'abbr',
      id: `abbr:${g.code}`,
      timezone: g.zones[0]!.timezone,
      titleZh: g.titleZh,
      titleEn: g.titleEn,
      subtitleZh: g.zones.map((z) => z.citiesZh).filter(Boolean).join(' · '),
      candidates: g.zones.map((z) => ({
        timezone: z.timezone,
        labelZh: `${z.labelZh}${z.citiesZh ? ` · ${z.citiesZh}` : ''}`,
        labelEn: z.labelEn,
      })),
      aliases: g.aliases,
      priority: 2,
    },
    tokens: g.aliases.map(norm),
    looseTokens: g.aliases.map(loose),
  })
}

// Countries as entries, so "英国" / "United Kingdom" resolves.
for (const country of COUNTRIES) {
  if (!country.zones.length) continue
  const cityIds = country.zones.map((z) => z.cityId).filter(Boolean)
  // Skip countries we have no seeded city for — nothing useful to show.
  if (!cityIds.length) continue
  INDEX.push({
    entry: {
      kind: 'zone',
      id: `country:${country.code}`,
      timezone: country.zones[0]!.timezone,
      titleZh: country.nameZh,
      titleEn: country.nameEn,
      subtitleZh:
        country.zones.length > 1
          ? `${country.zones.length} 个时区`
          : country.zones[0]!.citiesZh,
      candidates:
        country.zones.length > 1
          ? country.zones.map((z) => ({
              timezone: z.timezone,
              labelZh: `${z.labelZh} · ${z.citiesZh}`,
              labelEn: z.labelEn,
            }))
          : undefined,
      aliases: [country.nameZh, country.nameEn, country.code],
      priority: country.zones.length > 1 ? 2 : 3,
    },
    tokens: [country.nameZh, country.nameEn, country.code].map(norm),
    looseTokens: [country.nameZh, country.nameEn, country.code].map(loose),
  })
}

/** Parse "UTC+8", "GMT-5:30", "+08:00", "utc 8" into offset minutes. */
export function parseOffsetQuery(q: string): number | null {
  const m = /^(?:utc|gmt)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i.exec(q.trim())
  if (m) {
    const sign = m[1] === '-' ? -1 : 1
    const h = Number(m[2])
    const mi = Number(m[3] ?? 0)
    if (h > 14 || mi > 59) return null
    return sign * (h * 60 + mi)
  }
  if (/^(utc|gmt)\s*0?$/i.test(q.trim())) return 0
  return null
}

export interface SearchResult extends TzSearchEntry {
  score: number
}

/**
 * Rank entries for a query. Exact token match beats prefix beats substring;
 * lower `priority` (bigger city) wins ties.
 */
export function searchTimezones(query: string, instant: Date, limit = 40): SearchResult[] {
  const q = norm(query)
  if (!q) return []

  const out: SearchResult[] = []

  // Offset queries get synthesised results from the actual zone list.
  const offset = parseOffsetQuery(query)
  if (offset !== null) {
    const seen = new Set<string>()
    for (const c of CITIES) {
      if (offsetMinutes(c.timezone, instant) !== offset) continue
      if (seen.has(c.timezone)) continue
      seen.add(c.timezone)
      out.push({ ...cityEntry(c), score: 1000 - c.priority })
    }
    if (out.length) {
      out.sort((a, b) => b.score - a.score)
      return out.slice(0, limit)
    }
  }

  // A raw IANA id typed in full should always resolve.
  if (query.includes('/') && isValidTimeZone(query)) {
    const known = CITIES.find((c) => c.timezone === query)
    if (!known) {
      out.push({
        kind: 'zone',
        id: `zone:${query}`,
        timezone: query,
        titleZh: query.split('/').pop()!.replace(/_/g, ' '),
        titleEn: query,
        subtitleZh: formatOffset(offsetMinutes(query, instant)),
        aliases: [query],
        priority: 3,
        score: 2000,
      })
    }
  }

  const qLoose = loose(query).trim()

  for (const { entry, tokens, looseTokens } of INDEX) {
    let best = 0
    for (const t of tokens) {
      if (!t) continue
      let s = 0
      if (t === q) s = 900
      else if (t.startsWith(q)) s = 700 - Math.min(t.length - q.length, 60)
      if (s > best) best = s
    }
    if (best === 0) {
      // Substring only against space-preserving tokens, and only at a word
      // start, so "cst" cannot match inside "pacific standard time".
      for (const t of looseTokens) {
        if (!t) continue
        const at = t.indexOf(qLoose)
        if (at < 0) continue
        const atWordStart = at === 0 || t[at - 1] === ' '
        const s = atWordStart
          ? 450 - Math.min(t.length - qLoose.length, 60)
          : 260 - Math.min(t.length - qLoose.length, 60)
        if (s > best) best = s
      }
    }
    if (best > 0) {
      // Cities outrank abstract groups at equal textual match.
      const kindBonus = entry.kind === 'city' ? 40 : entry.kind === 'abbr' ? 30 : 0
      out.push({ ...entry, score: best + kindBonus - entry.priority * 8 })
    }
  }

  out.sort((a, b) => b.score - a.score || a.titleZh.localeCompare(b.titleZh))
  return out.slice(0, limit)
}

export const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]))
export const CITY_BY_ZONE = new Map<string, City>()
for (const c of [...CITIES].sort((a, b) => a.priority - b.priority)) {
  if (!CITY_BY_ZONE.has(c.timezone)) CITY_BY_ZONE.set(c.timezone, c)
}

/**
 * Best display name for a zone, preferring a seeded city.
 *
 * Etc/GMT zones carry POSIX-inverted signs — `Etc/GMT+9` is UTC-9 — so their
 * raw ids must never be shown. They are the nautical zones covering open
 * water, so they are labelled by their real offset instead.
 */
export function zoneLabel(timezone: string): { titleZh: string; subtitleZh: string } {
  const city = CITY_BY_ZONE.get(timezone)
  if (city) return { titleZh: city.nameZh, subtitleZh: city.countryZh }
  if (timezone === 'UTC' || timezone === 'Etc/UTC' || timezone === 'Etc/GMT') {
    return { titleZh: '协调世界时', subtitleZh: 'UTC' }
  }
  if (timezone.startsWith('Etc/GMT')) {
    // Sign is inverted in the id; derive the label from the true offset.
    const offset = offsetMinutes(timezone, new Date())
    return { titleZh: `${formatOffset(offset)} 海域`, subtitleZh: '公海 / 航海时区' }
  }
  // Unseeded zone: the id's region prefix ("Asia") is not a country, so show
  // the live offset instead of presenting a continent as a place name.
  return {
    titleZh: timezone.split('/').pop()!.replace(/_/g, ' '),
    subtitleZh: `${timezone} · ${formatOffset(offsetMinutes(timezone, new Date()))}`,
  }
}

/** True for the nautical Etc/GMT* zones, whose ids are misleading to users. */
export function isNauticalZone(timezone: string): boolean {
  return timezone.startsWith('Etc/') && timezone !== 'Etc/UTC'
}

/**
 * Nautical zone for a point at sea, derived from the 15° meridian bands that
 * actually define nautical time. The polygon data is land-clipped (so the map
 * keeps a real coastline), and open water needs no data to answer.
 *
 * Note the POSIX sign inversion: UTC-9 is `Etc/GMT+9`.
 */
export function nauticalZoneAt(longitude: number): string {
  let lng = ((longitude + 180) % 360 + 360) % 360 - 180
  if (lng === -180) lng = 180
  const hours = Math.round(lng / 15)
  if (hours === 0) return 'UTC'
  const clamped = Math.max(-12, Math.min(12, hours))
  return `Etc/GMT${clamped > 0 ? '-' : '+'}${Math.abs(clamped)}`
}
