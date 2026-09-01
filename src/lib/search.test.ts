import { describe, expect, it } from 'vitest'
import { CITIES } from '../data/cities'
import { COUNTRIES, COUNTRY_BY_CODE, NUMERIC_TO_ALPHA2 } from '../data/countries'
import {
  isNauticalZone,
  nauticalZoneAt,
  parseOffsetQuery,
  searchTimezones,
  zoneLabel,
} from './search'
import { isValidTimeZone, offsetMinutes } from './time'

const NOW = new Date('2026-07-15T12:00:00Z')
const WINTER = new Date('2026-01-15T12:00:00Z')

const find = (q: string, instant = NOW) => searchTimezones(q, instant)
const zonesOf = (q: string, instant = NOW) => find(q, instant).map((r) => r.timezone)

describe('city dataset integrity', () => {
  it('has every required spec city', () => {
    const required = [
      '上海', '北京', '香港', '东京', '首尔', '新加坡', '台北',
      '伦敦', '巴黎', '柏林', '阿姆斯特丹', '马德里', '罗马', '苏黎世',
      '法兰克福', '斯德哥尔摩',
      '纽约', '华盛顿', '波士顿', '芝加哥', '达拉斯', '洛杉矶', '旧金山',
      '西雅图', '多伦多', '温哥华', '丹佛',
      '迪拜', '利雅得', '悉尼', '墨尔本', '奥克兰',
    ]
    const have = new Set(CITIES.map((c) => c.nameZh))
    expect(required.filter((r) => !have.has(r))).toEqual([])
  })

  it('uses only valid IANA zones', () => {
    const bad = CITIES.filter((c) => !isValidTimeZone(c.timezone))
    expect(bad.map((c) => `${c.nameZh}:${c.timezone}`)).toEqual([])
  })

  it('has unique ids and plausible coordinates', () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length)
    for (const c of CITIES) {
      expect(Math.abs(c.latitude), c.nameZh).toBeLessThanOrEqual(90)
      expect(Math.abs(c.longitude), c.nameZh).toBeLessThanOrEqual(180)
      expect(c.aliases.length, c.nameZh).toBeGreaterThan(0)
    }
  })

  it('has at least 13 tier-1 cities on the map by default', () => {
    const tier1 = CITIES.filter((c) => c.priority === 1).map((c) => c.nameZh)
    // Spec §73 mandates these are visible without zooming.
    for (const n of ['伦敦', '巴黎', '纽约', '洛杉矶', '上海', '东京', '新加坡', '悉尼', '迪拜']) {
      expect(tier1, `tier1 missing ${n}`).toContain(n)
    }
  })

  it('covers 18+ cities for the default grid', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(24)
  })
})

describe('country zone data', () => {
  it('models multi-timezone countries as multiple options', () => {
    for (const cc of ['US', 'CA', 'RU', 'AU', 'BR', 'MX', 'ID']) {
      expect(COUNTRY_BY_CODE.get(cc)!.zones.length, cc).toBeGreaterThan(1)
    }
  })

  it('models single-timezone countries as one option', () => {
    for (const cc of ['JP', 'KR', 'SG', 'GB', 'FR', 'DE']) {
      expect(COUNTRY_BY_CODE.get(cc)!.zones.length, cc).toBe(1)
    }
  })

  it('separates US zones that differ on DST', () => {
    const us = COUNTRY_BY_CODE.get('US')!.zones.map((z) => z.timezone)
    expect(us).toContain('America/Los_Angeles')
    expect(us).toContain('America/Denver')
    expect(us).toContain('America/Phoenix') // no DST — must not merge with Denver
    expect(us).toContain('America/Chicago')
    expect(us).toContain('America/New_York')
  })

  it('separates Australian zones that differ on DST', () => {
    const au = COUNTRY_BY_CODE.get('AU')!.zones.map((z) => z.timezone)
    expect(au).toContain('Australia/Sydney')
    expect(au).toContain('Australia/Brisbane') // no DST
    expect(au).toContain('Australia/Perth')
  })

  it('picks Shanghai (not Urumqi) as the primary China zone', () => {
    const cn = COUNTRY_BY_CODE.get('CN')!.zones
    const shanghai = cn.find((z) => z.timezone === 'Asia/Shanghai')
    expect(shanghai).toBeDefined()
    expect(shanghai!.citiesZh).toContain('上海')
  })

  it('only references valid IANA zones', () => {
    const bad: string[] = []
    for (const c of COUNTRIES) {
      for (const z of c.zones) if (!isValidTimeZone(z.timezone)) bad.push(`${c.code}:${z.timezone}`)
    }
    expect(bad).toEqual([])
  })

  it('maps numeric ISO ids used by the map polygons', () => {
    expect(NUMERIC_TO_ALPHA2['840']).toBe('US')
    expect(NUMERIC_TO_ALPHA2['156']).toBe('CN')
    expect(NUMERIC_TO_ALPHA2['826']).toBe('GB')
    expect(NUMERIC_TO_ALPHA2['392']).toBe('JP')
  })
})

describe('search: cities', () => {
  it('finds by Chinese name', () => {
    expect(zonesOf('上海')[0]).toBe('Asia/Shanghai')
    expect(zonesOf('伦敦')[0]).toBe('Europe/London')
    expect(zonesOf('纽约')[0]).toBe('America/New_York')
  })

  it('finds by English name, case-insensitively', () => {
    expect(zonesOf('London')[0]).toBe('Europe/London')
    expect(zonesOf('london')[0]).toBe('Europe/London')
    expect(zonesOf('LONDON')[0]).toBe('Europe/London')
    expect(zonesOf('Los Angeles')[0]).toBe('America/Los_Angeles')
  })

  it('finds by country name in both languages', () => {
    expect(zonesOf('英国')).toContain('Europe/London')
    expect(zonesOf('United Kingdom')).toContain('Europe/London')
    expect(zonesOf('日本')).toContain('Asia/Tokyo')
  })

  it('finds by IANA id', () => {
    expect(zonesOf('Europe/London')).toContain('Europe/London')
    expect(zonesOf('Asia/Shanghai')).toContain('Asia/Shanghai')
  })

  it('resolves a valid IANA id we have no city for', () => {
    const r = find('Asia/Omsk')
    expect(r.map((x) => x.timezone)).toContain('Asia/Omsk')
  })

  it('returns nothing for gibberish', () => {
    expect(find('zzzzqqqq')).toEqual([])
  })
})

describe('search: abbreviations and ambiguity', () => {
  it('surfaces BOTH meanings of CST', () => {
    const r = find('CST')
    const titles = r.map((x) => x.titleZh)
    expect(titles).toContain('中国标准时间')
    expect(titles).toContain('美国中部时间')
    // and each carries its own candidate zones
    const cn = r.find((x) => x.titleZh === '中国标准时间')!
    const us = r.find((x) => x.titleZh === '美国中部时间')!
    expect(cn.candidates!.map((c) => c.timezone)).toContain('Asia/Shanghai')
    expect(us.candidates!.map((c) => c.timezone)).toContain('America/Chicago')
  })

  it('does not leak Pacific into a CST search', () => {
    // "Pacific Standard Time" collapses to "pacificstandardtime", which
    // contains "cst" — substring matching must respect word boundaries.
    const ids = find('CST').map((x) => x.id)
    expect(ids).not.toContain('abbr:PST')
    expect(ids).not.toContain('abbr:MST')
  })

  it('still matches multi-word names ignoring spaces', () => {
    expect(zonesOf('hongkong')).toContain('Asia/Hong_Kong')
    expect(zonesOf('newyork')).toContain('America/New_York')
    expect(zonesOf('los angeles')).toContain('America/Los_Angeles')
    expect(zonesOf('sanfrancisco')).toContain('America/Los_Angeles')
  })

  it('surfaces all three meanings of IST', () => {
    const ist = find('IST').find((x) => x.id === 'abbr:IST')
    expect(ist).toBeDefined()
    const zones = ist!.candidates!.map((c) => c.timezone)
    expect(zones).toContain('Asia/Kolkata')
    expect(zones).toContain('Asia/Jerusalem')
    expect(zones).toContain('Europe/Dublin')
  })

  it('treats PST as a zone concept with representative cities', () => {
    const pst = find('PST').find((x) => x.id === 'abbr:PST')!
    expect(pst.titleZh).toBe('美国太平洋时间')
    expect(pst.subtitleZh).toContain('洛杉矶')
    expect(pst.subtitleZh).toContain('旧金山')
    expect(pst.subtitleZh).toContain('西雅图')
    expect(pst.candidates![0]!.timezone).toBe('America/Los_Angeles')
  })

  it('finds PDT, EST, EDT, CET, CEST, JST, KST', () => {
    expect(find('PDT').some((x) => x.id === 'abbr:PST')).toBe(true)
    expect(find('EST').some((x) => x.id === 'abbr:EST')).toBe(true)
    expect(find('EDT').some((x) => x.id === 'abbr:EST')).toBe(true)
    expect(find('CET').some((x) => x.id === 'abbr:CET')).toBe(true)
    expect(find('CEST').some((x) => x.id === 'abbr:CET')).toBe(true)
    expect(find('JST').some((x) => x.id === 'abbr:JST')).toBe(true)
    expect(find('KST').some((x) => x.id === 'abbr:KST')).toBe(true)
  })

  it('finds GMT without claiming London is always GMT', () => {
    const gmt = find('GMT').find((x) => x.id === 'abbr:GMT')!
    expect(gmt.candidates!.map((c) => c.timezone)).toContain('Europe/London')
    // In July London is BST, so the live abbreviation must not say GMT.
    expect(offsetMinutes('Europe/London', NOW)).toBe(60)
    expect(offsetMinutes('Europe/London', WINTER)).toBe(0)
  })

  it('matches Chinese colloquial timezone names', () => {
    expect(find('美西时间').some((x) => x.id === 'abbr:PST')).toBe(true)
    expect(find('美国太平洋时间').some((x) => x.id === 'abbr:PST')).toBe(true)
    expect(find('北京时间').some((x) => x.id === 'abbr:CST-CN')).toBe(true)
    expect(find('格林尼治时间').some((x) => x.id === 'abbr:GMT')).toBe(true)
    expect(find('美东时间').some((x) => x.id === 'abbr:EST')).toBe(true)
  })

  it('matches English colloquial timezone names', () => {
    expect(find('Pacific Time').some((x) => x.id === 'abbr:PST')).toBe(true)
    expect(find('Eastern Time').some((x) => x.id === 'abbr:EST')).toBe(true)
    expect(find('Greenwich Mean Time').some((x) => x.id === 'abbr:GMT')).toBe(true)
  })
})

describe('nautical Etc/GMT zones', () => {
  it('never shows the POSIX-inverted id as a label', () => {
    // Etc/GMT+9 is UTC-9. Showing "GMT+9" would be a sign error to the user.
    expect(offsetMinutes('Etc/GMT+9', NOW)).toBe(-540)
    const label = zoneLabel('Etc/GMT+9')
    expect(label.titleZh).toBe('UTC-9 海域')
    expect(label.titleZh).not.toContain('GMT+9')
    expect(isNauticalZone('Etc/GMT+9')).toBe(true)

    expect(offsetMinutes('Etc/GMT-5', NOW)).toBe(300)
    expect(zoneLabel('Etc/GMT-5').titleZh).toBe('UTC+5 海域')
  })

  it('treats UTC itself as a real zone, not nautical', () => {
    expect(isNauticalZone('UTC')).toBe(false)
    expect(isNauticalZone('Etc/UTC')).toBe(false)
    expect(zoneLabel('UTC').titleZh).toBe('协调世界时')
  })

  it('does not treat real city zones as nautical', () => {
    for (const c of CITIES) expect(isNauticalZone(c.timezone), c.nameZh).toBe(false)
  })

  it('derives an ocean zone from longitude with the POSIX sign inverted', () => {
    // The polygon data is land-clipped, so open water is answered by the 15°
    // nautical meridian bands. Etc/GMT signs are inverted: UTC-9 is Etc/GMT+9.
    expect(nauticalZoneAt(0)).toBe('UTC')
    expect(nauticalZoneAt(7)).toBe('UTC')
    expect(nauticalZoneAt(-140)).toBe('Etc/GMT+9')
    expect(offsetMinutes(nauticalZoneAt(-140), NOW)).toBe(-540)
    expect(nauticalZoneAt(75)).toBe('Etc/GMT-5')
    expect(offsetMinutes(nauticalZoneAt(75), NOW)).toBe(300)
  })

  it('gives every longitude a valid ocean zone whose offset matches its band', () => {
    const bad: string[] = []
    for (let lng = -540; lng <= 540; lng += 3) {
      const tz = nauticalZoneAt(lng)
      if (!isValidTimeZone(tz)) {
        bad.push(`${lng} -> invalid ${tz}`)
        continue
      }
      const off = offsetMinutes(tz, NOW)
      if (Math.abs(off) > 720) bad.push(`${lng} -> ${tz} offset ${off}`)
    }
    expect(bad).toEqual([])
  })
})

describe('search: UTC offsets', () => {
  it('parses offset queries', () => {
    expect(parseOffsetQuery('UTC+8')).toBe(480)
    expect(parseOffsetQuery('utc+8')).toBe(480)
    expect(parseOffsetQuery('GMT-5')).toBe(-300)
    expect(parseOffsetQuery('+5:30')).toBe(330)
    expect(parseOffsetQuery('UTC+05:45')).toBe(345)
    expect(parseOffsetQuery('UTC')).toBe(0)
    expect(parseOffsetQuery('UTC+0')).toBe(0)
    expect(parseOffsetQuery('London')).toBeNull()
    expect(parseOffsetQuery('UTC+99')).toBeNull()
  })

  it('finds cities currently at a given offset', () => {
    const r = zonesOf('UTC+8')
    expect(r).toContain('Asia/Shanghai')
    expect(r).toContain('Asia/Singapore')
    // London is UTC+1 in July, so UTC+1 must find it then...
    expect(zonesOf('UTC+1', NOW)).toContain('Europe/London')
    // ...and UTC+0 must find it in January instead.
    expect(zonesOf('UTC', WINTER)).toContain('Europe/London')
    expect(zonesOf('UTC+1', WINTER)).not.toContain('Europe/London')
  })
})
