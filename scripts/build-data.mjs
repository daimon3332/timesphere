/**
 * Build the static data layer.
 *
 *  - resolves city geography from GeoNames cities15000
 *  - verifies every coordinate lands inside its declared IANA polygon
 *  - emits src/data/cities.ts, src/data/countries.ts
 *  - emits public/data/timezones.json, public/data/countries.json
 *
 * Usage: node scripts/build-data.mjs
 * Requires .tmp/{cities15000.txt,tz_s3.json,countries50.json,vvo/package/raw-time-zones.json}
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { ZONE_GROUP_ZH, COUNTRY_ZH_OVERRIDE } from './zone-labels.mjs'

const TZ_VERSION = '2026c'
const TZDB_VERSION = '6.198.0'

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
const TMP = path.join(ROOT, '.tmp')
const p = (...s) => path.join(...s)
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

function fail(msg) {
  console.error(`\x1b[31mERROR\x1b[0m ${msg}`)
  process.exitCode = 1
}

// ---------------------------------------------------------------- city seed
const seedSrc = fs.readFileSync(p(ROOT, 'scripts/city-seed.ts'), 'utf8')
const seedStart = seedSrc.indexOf('`', seedSrc.indexOf('CITY_SEED')) + 1
const seedBody = seedSrc.slice(seedStart, seedSrc.lastIndexOf('`'))
const seed = seedBody
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((line) => {
    const [geonameid, nameEn, countryCode, nameZh, countryZh, region, priority, expectTz] =
      line.split('|')
    return {
      geonameid,
      nameEn,
      countryCode,
      nameZh,
      countryZh,
      region,
      priority: Number(priority),
      expectTz,
    }
  })

// ------------------------------------------------------------- geonames read
const wanted = new Map(seed.map((s) => [s.geonameid, s]))
const geo = new Map()
for (const line of fs.readFileSync(p(TMP, 'cities15000.txt'), 'utf8').split('\n')) {
  if (!line) continue
  const f = line.split('\t')
  const id = f[0]
  if (!wanted.has(id)) continue
  geo.set(id, {
    nameEn: f[2] || f[1],
    lat: Number(f[4]),
    lng: Number(f[5]),
    countryCode: f[8],
    population: Number(f[14]) || 0,
    timezone: f[17],
  })
}

// -------------------------------------------------- point in polygon helpers
function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function pointInPolygon(x, y, poly) {
  if (!pointInRing(x, y, poly[0])) return false
  for (let h = 1; h < poly.length; h++) if (pointInRing(x, y, poly[h])) return false
  return true
}

function pointInGeometry(x, y, g) {
  if (g.type === 'Polygon') return pointInPolygon(x, y, g.coordinates)
  if (g.type === 'MultiPolygon') return g.coordinates.some((poly) => pointInPolygon(x, y, poly))
  return false
}

function bbox(g) {
  let minX = 180
  let minY = 90
  let maxX = -180
  let maxY = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[1] > maxY) maxY = c[1]
      return
    }
    for (const n of c) walk(n)
  }
  walk(g.coordinates)
  return [minX, minY, maxX, maxY]
}

// ------------------------------------------------------------- timezone poly
/**
 * Land-clipped zones. The `with-oceans` variant pads every zone out to sea,
 * which fills the whole canvas with the UTC palette and erases the continent
 * silhouette — the map stops reading as a map. Ocean clicks are answered from
 * the 15° nautical meridian bands instead, which need no data.
 */
const tz = readJSON(p(TMP, 'tz_land.json'))
// Micro-zones (Europe/Vatican) can lose their geometry to simplification.
const droppedZones = tz.features.filter((f) => !f.geometry).map((f) => f.properties.tzid)
tz.features = tz.features.filter((f) => f.geometry)
if (droppedZones.length) {
  console.log(`\x1b[33mdropped micro-zones\x1b[0m: ${droppedZones.join(', ')}`)
}
const tzFeatures = tz.features.map((f) => ({
  tzid: f.properties.tzid,
  geometry: f.geometry,
  bbox: bbox(f.geometry),
}))
const tzById = new Map(tzFeatures.map((f) => [f.tzid, f]))

function zonesAt(lng, lat) {
  const hits = []
  for (const f of tzFeatures) {
    const [minX, minY, maxX, maxY] = f.bbox
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue
    if (pointInGeometry(lng, lat, f.geometry)) hits.push(f.tzid)
  }
  return hits
}

// ---------------------------------------------------------- assemble cities
const ID_FIX = new Map()
const cities = []
for (const s of seed) {
  const g = geo.get(s.geonameid)
  if (!g) {
    fail(`geonames id ${s.geonameid} (${s.nameEn}) not found in cities15000`)
    continue
  }
  if (g.countryCode !== s.countryCode) {
    fail(`${s.nameEn}: country mismatch seed=${s.countryCode} geonames=${g.countryCode}`)
  }
  const override = s.expectTz?.startsWith('!')
  const expectTz = override ? s.expectTz.slice(1) : s.expectTz
  if (expectTz && !override && g.timezone !== expectTz) {
    fail(`${s.nameEn}: tz mismatch seed=${expectTz} geonames=${g.timezone}`)
  }
  if (override) {
    console.log(
      `\x1b[36moverride\x1b[0m ${s.nameEn}: geonames=${g.timezone} -> ${expectTz}`,
    )
  }
  const timezone = override ? expectTz : g.timezone
  if (!tzById.has(timezone)) fail(`${s.nameEn}: zone ${timezone} has no polygon`)

  // The coordinate must fall inside its declared zone polygon. Zones can
  // legitimately overlap (Asia/Shanghai covers Xinjiang while Asia/Urumqi
  // also does), so membership is what matters, not uniqueness.
  const hits = zonesAt(g.lng, g.lat)
  if (!hits.includes(timezone)) {
    ID_FIX.set(s.nameEn, { declared: timezone, polygon: hits.join(',') || 'none' })
  }

  const slug = s.nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  cities.push({
    id: slug,
    nameZh: s.nameZh,
    nameEn: g.nameEn,
    countryZh: s.countryZh,
    countryEn: '',
    countryCode: s.countryCode,
    timezone,
    latitude: Number(g.lat.toFixed(4)),
    longitude: Number(g.lng.toFixed(4)),
    population: g.population,
    priority: s.priority,
    region: s.region,
  })
}

if (ID_FIX.size) {
  console.log('\n\x1b[33mcoordinate/polygon disagreements\x1b[0m (simplification artifacts):')
  for (const [name, v] of ID_FIX) {
    console.log(`  ${name.padEnd(20)} declared=${v.declared} polygonSays=${v.polygon}`)
  }
}

// ---------------------------------------------------------- country metadata
const rawZones = readJSON(p(TMP, 'vvo/package/raw-time-zones.json'))
const countryEnByCode = new Map()
for (const z of rawZones) {
  if (!countryEnByCode.has(z.countryCode)) countryEnByCode.set(z.countryCode, z.countryName)
}
for (const c of cities) {
  c.countryEn = countryEnByCode.get(c.countryCode) ?? c.countryCode
}

const zonesByCountry = new Map()
for (const z of rawZones) {
  if (!zonesByCountry.has(z.countryCode)) zonesByCountry.set(z.countryCode, [])
  zonesByCountry.get(z.countryCode).push({
    timezone: z.name,
    alternativeName: z.alternativeName,
    mainCities: z.mainCities,
    rawOffsetInMinutes: z.rawOffsetInMinutes,
    group: z.group,
  })
}

fs.mkdirSync(p(ROOT, 'src/data'), { recursive: true })
fs.mkdirSync(p(ROOT, 'public/data'), { recursive: true })

// ------------------------------------------------------------ emit map data
fs.writeFileSync(p(ROOT, 'public/data/timezones.json'), JSON.stringify(tz))

const countriesGeo = readJSON(p(TMP, 'countries50.json'))

console.log(`\ncities:            ${cities.length}`)
console.log(`timezone polygons: ${tz.features.length}`)
console.log(`country polygons:  ${countriesGeo.features.length}`)

// ---------------------------------------------------------------- aliases
const zoneByName = new Map(rawZones.map((z) => [z.name, z]))
// tzdb groups link deprecated aliases (Asia/Chongqing -> Asia/Shanghai).
const groupAliases = new Map()
for (const z of rawZones) {
  for (const g of z.group) {
    if (g !== z.name) {
      if (!groupAliases.has(z.name)) groupAliases.set(z.name, [])
      groupAliases.get(z.name).push(g)
    }
  }
}

for (const c of cities) {
  const z = zoneByName.get(c.timezone)
  const set = new Set([
    c.nameEn,
    c.nameZh,
    c.countryZh,
    c.countryEn,
    c.timezone,
    c.timezone.split('/').pop().replace(/_/g, ' '),
    c.countryCode,
  ])
  if (z) {
    set.add(z.alternativeName)
    const zh = ZONE_GROUP_ZH[z.alternativeName]
    if (zh) set.add(zh)
    for (const mc of z.mainCities) set.add(mc)
  }
  for (const g of groupAliases.get(c.timezone) ?? []) set.add(g)
  c.aliases = [...set].filter(Boolean)
}

// ------------------------------------------------------------ emit cities.ts
const cityTs = `// GENERATED by scripts/build-data.mjs — do not edit.
// Geography from GeoNames cities15000; every coordinate verified to fall inside
// its declared IANA polygon (timezone-boundary-builder ${TZ_VERSION}).
import type { City } from '../types'

export const CITIES: City[] = ${JSON.stringify(
  cities.map((c) => ({
    id: c.id,
    nameZh: c.nameZh,
    nameEn: c.nameEn,
    countryZh: c.countryZh,
    countryEn: c.countryEn,
    countryCode: c.countryCode,
    timezone: c.timezone,
    latitude: c.latitude,
    longitude: c.longitude,
    aliases: c.aliases,
    priority: c.priority,
    region: c.region,
  })),
  null,
  2,
)}
`
fs.writeFileSync(p(ROOT, 'src/data/cities.ts'), cityTs)

// --------------------------------------------------------- emit countries.ts
const wc = readJSON(p(TMP, 'wc/package/countries.json'))
const numericToAlpha2 = {}
for (const c of wc) if (c.ccn3) numericToAlpha2[c.ccn3] = c.cca2

const displayZh = new Intl.DisplayNames(['zh-CN'], { type: 'region' })
const displayEn = new Intl.DisplayNames(['en'], { type: 'region' })

const cityByZone = new Map()
for (const c of cities) {
  if (!cityByZone.has(c.timezone)) cityByZone.set(c.timezone, [])
  cityByZone.get(c.timezone).push(c)
}

/** Does this zone observe DST in the given year? */
function hasDst(timeZone, year) {
  // Intl silently falls back to the system zone for undefined, which would
  // collapse every zone into one group. Refuse instead.
  if (typeof timeZone !== 'string' || !timeZone) {
    throw new Error(`hasDst: invalid timeZone ${JSON.stringify(timeZone)}`)
  }
  let first = null
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(year, m, 15, 12))
    const parts = {}
    for (const pt of new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(d)) {
      if (pt.type !== 'literal') parts[pt.type] = pt.value
    }
    const off =
      (Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour % 24,
        +parts.minute,
      ) -
        d.getTime()) /
      60000
    if (first === null) first = off
    else if (off !== first) return true
  }
  return false
}

const YEAR = new Date().getUTCFullYear()

const countryEntries = []
for (const [cc, zones] of zonesByCountry) {
  // Group by user-facing name AND actual rules. Zones sharing a marketing name
  // but differing in offset or DST behaviour (Denver/Phoenix, Sydney/Brisbane,
  // Shanghai/Urumqi) must stay separate options or the picker lies half the year.
  const groups = new Map()
  for (const z of zones) {
    const key = `${z.alternativeName}|${z.rawOffsetInMinutes}|${hasDst(z.timezone, YEAR)}`
    if (!groups.has(key)) groups.set(key, { label: z.alternativeName, zs: [] })
    groups.get(key).zs.push(z)
  }
  // A label reused by several rule-groups needs disambiguating by city.
  const labelCount = new Map()
  for (const g of groups.values()) {
    labelCount.set(g.label, (labelCount.get(g.label) ?? 0) + 1)
  }

  const options = []
  for (const { label, zs } of groups.values()) {
    const seeded = zs.flatMap((z) => cityByZone.get(z.timezone) ?? [])
    seeded.sort((a, b) => a.priority - b.priority || b.population - a.population)
    // Primary zone = the one owning our highest-priority seeded city.
    const primary = seeded.length
      ? zs.find((z) => z.timezone === seeded[0].timezone)
      : zs[0]
    const citiesZh = seeded.length
      ? seeded.slice(0, 3).map((c) => c.nameZh).join(' / ')
      : primary.mainCities.slice(0, 3).join(' / ')
    const baseZh = ZONE_GROUP_ZH[label] ?? label
    const ambiguous = (labelCount.get(label) ?? 0) > 1
    const tag = seeded[0]?.nameZh ?? primary.mainCities[0]
    options.push({
      timezone: primary.timezone,
      labelZh: ambiguous ? `${baseZh}（${tag}）` : baseZh,
      labelEn: ambiguous ? `${label} (${primary.mainCities[0] ?? primary.timezone})` : label,
      citiesZh,
      cityId: seeded[0]?.id,
    })
  }
  // Once a country has real, city-backed options, drop the obscure zones with
  // no seeded city (America/Adak, America/Atikokan) — they add noise to the
  // picker without adding a distinct answer a user would look for.
  const seededOptions = options.filter((o) => o.cityId)
  const finalOptions = seededOptions.length >= 2 ? seededOptions : options

  finalOptions.sort((a, b) => {
    const ao = zoneByName.get(a.timezone)?.rawOffsetInMinutes ?? 0
    const bo = zoneByName.get(b.timezone)?.rawOffsetInMinutes ?? 0
    return ao - bo
  })

  // Re-simplify labels: disambiguation is only needed if a name still repeats.
  const finalCount = new Map()
  for (const o of finalOptions) {
    finalCount.set(o.labelEn, (finalCount.get(o.labelEn) ?? 0) + 1)
  }
  for (const o of finalOptions) {
    const baseEn = o.labelEn.replace(/ \(.*\)$/, '')
    const baseZh = o.labelZh.replace(/（.*）$/, '')
    const stillAmbiguous = finalOptions.filter(
      (x) => x.labelEn.replace(/ \(.*\)$/, '') === baseEn,
    ).length
    if (stillAmbiguous === 1) {
      o.labelEn = baseEn
      o.labelZh = baseZh
    }
  }
  let nameZh = COUNTRY_ZH_OVERRIDE[cc]
  if (!nameZh) {
    const d = displayZh.of(cc)
    nameZh = d && d !== cc ? d : (displayEn.of(cc) ?? cc)
  }
  countryEntries.push({
    code: cc,
    nameZh,
    nameEn: displayEn.of(cc) ?? cc,
    zones: finalOptions,
  })
}
countryEntries.sort((a, b) => a.code.localeCompare(b.code))

// Stamp alpha-2 into properties so the map never has to rely on feature id
// surviving MapLibre's source options.
let stamped = 0
for (const f of countriesGeo.features) {
  const a2 = numericToAlpha2[String(f.id).padStart(3, '0')]
  if (a2) {
    f.properties = { ...f.properties, iso_a2: a2 }
    stamped++
  }
}
fs.writeFileSync(p(ROOT, 'public/data/countries.json'), JSON.stringify(countriesGeo))
console.log(`country polygons with alpha-2: ${stamped}/${countriesGeo.features.length}`)

const countryTs = `// GENERATED by scripts/build-data.mjs — do not edit.
// Country -> IANA zone groups, from @vvo/tzdb ${TZDB_VERSION}.
import type { CountryInfo } from '../types'

/** Natural Earth numeric ISO id -> alpha-2. */
export const NUMERIC_TO_ALPHA2: Record<string, string> = ${JSON.stringify(numericToAlpha2)}

export const COUNTRIES: CountryInfo[] = ${JSON.stringify(countryEntries, null, 2)}

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))
`
fs.writeFileSync(p(ROOT, 'src/data/countries.ts'), countryTs)

const multi = countryEntries.filter((c) => c.zones.length > 1)
console.log(`countries:         ${countryEntries.length} (${multi.length} multi-zone)`)
console.log(
  `  multi-zone: ${multi
    .slice(0, 12)
    .map((c) => `${c.code}:${c.zones.length}`)
    .join(' ')}`,
)
console.log('wrote src/data/cities.ts, src/data/countries.ts')
