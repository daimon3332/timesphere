import { describe, expect, it } from 'vitest'
import { CITIES } from './cities'
import { lookupAbbr } from './abbr-glossary'
import { offsetMinutes, zoneNaming } from '../lib/time'
import { explainAbbr, upcomingZoneNames } from '../lib/zone-names'

const WINTER = new Date('2026-01-15T12:00:00Z')
const SUMMER = new Date('2026-07-15T12:00:00Z')

describe('abbreviation glossary', () => {
  it('explains every abbreviation any city can display', () => {
    const missing = new Set<string>()
    for (const tz of new Set(CITIES.map((c) => c.timezone))) {
      for (let m = 0; m < 24; m++) {
        const at = new Date(Date.UTC(2026, m, 15, 12))
        const abbr = zoneNaming(tz, at).abbreviation
        if (/^(GMT|UTC)[+-]/.test(abbr)) continue
        if (!lookupAbbr(abbr, offsetMinutes(tz, at))) missing.add(`${abbr}@${tz}`)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('tells apart abbreviations that mean different things', () => {
    const name = (tz: string, at: Date) =>
      explainAbbr(tz, zoneNaming(tz, at).abbreviation, offsetMinutes(tz, at), at).nameZh
    expect(name('Europe/London', SUMMER)).toBe('英国夏令时间')
    expect(name('Asia/Dhaka', SUMMER)).toBe('孟加拉国标准时间')
    expect(name('Asia/Shanghai', SUMMER)).toBe('中国标准时间')
    expect(name('America/Chicago', WINTER)).toBe('北美中部标准时间')
    expect(name('Asia/Kolkata', WINTER)).toBe('印度标准时间')
    expect(name('Asia/Jerusalem', WINTER)).toBe('以色列标准时间')
    expect(name('Europe/Dublin', SUMMER)).toBe('爱尔兰标准时间')
    expect(name('Asia/Manila', WINTER)).toBe('菲律宾标准时间')
    expect(name('America/Los_Angeles', WINTER)).toBe('太平洋标准时间')
  })

  it('falls back to the platform name for uncurated zones', () => {
    const n = explainAbbr('America/La_Paz', 'BOT', -240, WINTER)
    expect(n.entry).toBeNull()
    expect(n.nameZh.length).toBeGreaterThan(0)
    expect(n.nameEn.length).toBeGreaterThan(0)
  })

  it('lists both seasonal names for switching zones and one for fixed zones', () => {
    expect(upcomingZoneNames('Europe/London', WINTER).map((n) => n.abbr)).toEqual(['GMT', 'BST'])
    expect(upcomingZoneNames('Australia/Sydney', WINTER).map((n) => n.abbr)).toEqual(['AEST', 'AEDT'])
    expect(upcomingZoneNames('Asia/Tokyo', WINTER).map((n) => n.abbr)).toEqual(['JST'])
  })
})
