import { describe, expect, it } from 'vitest'
import {
  describeZone,
  formatDifference,
  formatDifferenceShort,
  formatOffset,
  instantFromZonedWallClock,
  offsetMinutes,
  resolveZonedWallClock,
  zoneNaming,
  zonedParts,
} from './time'

/** 2026-01-15T12:00Z — northern winter */
const WINTER = new Date('2026-01-15T12:00:00Z')
/** 2026-07-15T12:00Z — northern summer */
const SUMMER = new Date('2026-07-15T12:00:00Z')

describe('offsetMinutes', () => {
  it('handles fixed-offset zones', () => {
    expect(offsetMinutes('Asia/Shanghai', WINTER)).toBe(480)
    expect(offsetMinutes('Asia/Shanghai', SUMMER)).toBe(480)
    expect(offsetMinutes('Asia/Tokyo', SUMMER)).toBe(540)
    expect(offsetMinutes('UTC', SUMMER)).toBe(0)
  })

  it('tracks DST across the year', () => {
    expect(offsetMinutes('Europe/London', WINTER)).toBe(0)
    expect(offsetMinutes('Europe/London', SUMMER)).toBe(60)
    expect(offsetMinutes('America/Los_Angeles', WINTER)).toBe(-480)
    expect(offsetMinutes('America/Los_Angeles', SUMMER)).toBe(-420)
    expect(offsetMinutes('America/New_York', WINTER)).toBe(-300)
    expect(offsetMinutes('America/New_York', SUMMER)).toBe(-240)
    expect(offsetMinutes('Europe/Paris', WINTER)).toBe(60)
    expect(offsetMinutes('Europe/Paris', SUMMER)).toBe(120)
  })

  it('handles southern-hemisphere DST inverted', () => {
    expect(offsetMinutes('Australia/Sydney', WINTER)).toBe(660)
    expect(offsetMinutes('Australia/Sydney', SUMMER)).toBe(600)
    expect(offsetMinutes('Australia/Brisbane', WINTER)).toBe(600)
    expect(offsetMinutes('Australia/Brisbane', SUMMER)).toBe(600)
  })

  it('supports non-integer offsets', () => {
    expect(offsetMinutes('Asia/Kolkata', SUMMER)).toBe(330)
    expect(offsetMinutes('Asia/Kathmandu', SUMMER)).toBe(345)
    expect(offsetMinutes('Australia/Adelaide', WINTER)).toBe(630)
    expect(offsetMinutes('Australia/Darwin', WINTER)).toBe(570)
    expect(offsetMinutes('America/St_Johns', WINTER)).toBe(-210)
    expect(offsetMinutes('America/St_Johns', SUMMER)).toBe(-150)
    // Chatham is southern hemisphere: Jan is its DST (+13:45), Jul standard (+12:45).
    expect(offsetMinutes('Pacific/Chatham', WINTER)).toBe(825)
    expect(offsetMinutes('Pacific/Chatham', SUMMER)).toBe(765)
  })

  it('is exact at a DST transition boundary', () => {
    // US DST 2026 starts 2026-03-08 02:00 local.
    expect(offsetMinutes('America/New_York', new Date('2026-03-08T06:59:00Z'))).toBe(-300)
    expect(offsetMinutes('America/New_York', new Date('2026-03-08T07:00:00Z'))).toBe(-240)
    // EU DST 2026 starts 2026-03-29 01:00 UTC.
    expect(offsetMinutes('Europe/London', new Date('2026-03-29T00:59:00Z'))).toBe(0)
    expect(offsetMinutes('Europe/London', new Date('2026-03-29T01:00:00Z'))).toBe(60)
  })
})

describe('formatOffset', () => {
  it('formats integer, fractional and zero offsets', () => {
    expect(formatOffset(480)).toBe('UTC+8')
    expect(formatOffset(0)).toBe('UTC')
    expect(formatOffset(-480)).toBe('UTC-8')
    expect(formatOffset(330)).toBe('UTC+5:30')
    expect(formatOffset(345)).toBe('UTC+5:45')
    expect(formatOffset(-210)).toBe('UTC-3:30')
    expect(formatOffset(765)).toBe('UTC+12:45')
  })
})

describe('zoneNaming', () => {
  it('gives DST-correct abbreviations for northern zones', () => {
    expect(zoneNaming('Europe/London', WINTER)).toMatchObject({
      abbreviation: 'GMT',
      isDST: false,
    })
    expect(zoneNaming('Europe/London', SUMMER)).toMatchObject({
      abbreviation: 'BST',
      isDST: true,
    })
    expect(zoneNaming('America/Los_Angeles', WINTER)).toMatchObject({
      abbreviation: 'PST',
      isDST: false,
    })
    expect(zoneNaming('America/Los_Angeles', SUMMER)).toMatchObject({
      abbreviation: 'PDT',
      isDST: true,
    })
    expect(zoneNaming('America/New_York', WINTER)).toMatchObject({
      abbreviation: 'EST',
      isDST: false,
    })
    expect(zoneNaming('America/New_York', SUMMER)).toMatchObject({
      abbreviation: 'EDT',
      isDST: true,
    })
    expect(zoneNaming('Europe/Paris', WINTER)).toMatchObject({
      abbreviation: 'CET',
      isDST: false,
    })
    expect(zoneNaming('Europe/Paris', SUMMER)).toMatchObject({
      abbreviation: 'CEST',
      isDST: true,
    })
  })

  it('never marks non-DST zones as DST', () => {
    for (const z of [
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Asia/Singapore',
      'Asia/Dubai',
      'Asia/Kolkata',
      'America/Phoenix',
      'Australia/Brisbane',
      'Africa/Nairobi',
    ]) {
      expect(zoneNaming(z, WINTER).isDST, `${z} winter`).toBe(false)
      expect(zoneNaming(z, SUMMER).isDST, `${z} summer`).toBe(false)
    }
  })

  it('inverts DST for southern-hemisphere zones', () => {
    expect(zoneNaming('Australia/Sydney', WINTER)).toMatchObject({
      abbreviation: 'AEDT',
      isDST: true,
    })
    expect(zoneNaming('Australia/Sydney', SUMMER)).toMatchObject({
      abbreviation: 'AEST',
      isDST: false,
    })
  })

  it('keeps fixed-abbreviation zones stable', () => {
    expect(zoneNaming('Asia/Shanghai', SUMMER).abbreviation).toBe('CST')
    expect(zoneNaming('Asia/Tokyo', SUMMER).abbreviation).toBe('JST')
    expect(zoneNaming('Asia/Seoul', SUMMER).abbreviation).toBe('KST')
    expect(zoneNaming('Asia/Kolkata', SUMMER).abbreviation).toBe('IST')
  })

  it('gives Dublin IST in summer, GMT in winter', () => {
    // tzdata models Irish winter as negative DST, so isDST is false all year.
    // Keying the abbreviation off isDST printed "GMT" while the offset was
    // UTC+1 — a self-contradictory label.
    expect(offsetMinutes('Europe/Dublin', SUMMER)).toBe(60)
    expect(zoneNaming('Europe/Dublin', SUMMER).abbreviation).toBe('IST')
    expect(offsetMinutes('Europe/Dublin', WINTER)).toBe(0)
    expect(zoneNaming('Europe/Dublin', WINTER).abbreviation).toBe('GMT')
  })

  it('never labels a non-zero offset as GMT or UTC', () => {
    // Structural invariant: an abbreviation may not contradict its offset.
    const zones = [
      'Europe/Dublin', 'Europe/London', 'Africa/Casablanca', 'Antarctica/Troll',
      'Europe/Lisbon', 'Atlantic/Canary', 'Africa/Accra', 'UTC',
      'America/New_York', 'America/Los_Angeles', 'Asia/Shanghai', 'Asia/Tokyo',
      'Australia/Sydney', 'Australia/Brisbane', 'America/Phoenix', 'Asia/Tehran',
      'Asia/Kolkata', 'Pacific/Auckland', 'Europe/Paris', 'Europe/Athens',
    ]
    for (const z of zones) {
      for (const instant of [WINTER, SUMMER]) {
        const { abbreviation } = zoneNaming(z, instant)
        const off = offsetMinutes(z, instant)
        if (/^(GMT|UTC|WET|CET|EET)$/.test(abbreviation)) {
          // These bare names all denote a specific offset; assert they match.
          const expected = { GMT: 0, UTC: 0, WET: 0, CET: 60, EET: 120 }[
            abbreviation as 'GMT' | 'UTC' | 'WET' | 'CET' | 'EET'
          ]
          expect(off, `${z} says ${abbreviation} but is ${formatOffset(off)}`).toBe(expected)
        }
        // A "+N" style fallback must state the true offset.
        const m = /^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(abbreviation)
        if (m) {
          const mins = Number(m[1]) * 60 + (m[1]!.startsWith('-') ? -1 : 1) * Number(m[2] ?? 0)
          expect(mins, `${z} fallback ${abbreviation} vs ${off}`).toBe(off)
        }
      }
    }
  })

  it('does not report DST for permanent-offset Casablanca', () => {
    // Morocco sits on UTC+1 year-round and steps *back* for Ramadan, so
    // "UTC+1" must not be reported as summer time.
    expect(offsetMinutes('Africa/Casablanca', SUMMER)).toBe(60)
    expect(zoneNaming('Africa/Casablanca', SUMMER).isDST).toBe(false)
  })
})

describe('describeZone', () => {
  it('computes the difference from real offsets, not static ones', () => {
    // Shanghai UTC+8 vs London BST UTC+1 in summer -> 7h behind.
    const london = describeZone('Europe/London', SUMMER, 'Asia/Shanghai')
    expect(london.differenceMinutes).toBe(-420)
    expect(london.abbreviation).toBe('BST')
    expect(london.utcOffset).toBe('UTC+1')

    // Same pair in winter -> 8h behind, because London drops to GMT.
    const londonWinter = describeZone('Europe/London', WINTER, 'Asia/Shanghai')
    expect(londonWinter.differenceMinutes).toBe(-480)
    expect(londonWinter.abbreviation).toBe('GMT')
  })

  it('reports the local wall clock correctly', () => {
    // 2026-07-15T12:00Z -> Shanghai 20:00 same day.
    const sh = describeZone('Asia/Shanghai', SUMMER, 'Asia/Shanghai')
    expect(sh.localTime).toBe('20:00')
    expect(sh.date).toBe('2026-07-15')
    expect(sh.differenceMinutes).toBe(0)

    // -> Los Angeles 05:00 same day (PDT).
    const la = describeZone('America/Los_Angeles', SUMMER, 'Asia/Shanghai')
    expect(la.localTime).toBe('05:00')
    expect(la.date).toBe('2026-07-15')
    expect(la.differenceMinutes).toBe(-900)
  })

  it('detects day rollover relative to the base zone', () => {
    // 2026-07-15T20:00Z: Shanghai is already 2026-07-16 04:00.
    const instant = new Date('2026-07-15T20:00:00Z')
    const sh = describeZone('Asia/Shanghai', instant, 'Asia/Shanghai')
    expect(sh.date).toBe('2026-07-16')
    // Los Angeles is still 2026-07-15 13:00 -> yesterday from Shanghai.
    const la = describeZone('America/Los_Angeles', instant, 'Asia/Shanghai')
    expect(la.date).toBe('2026-07-15')
    expect(la.dayRelation).toBe('yesterday')

    // Reverse the base: from LA, Shanghai is tomorrow.
    const shFromLA = describeZone('Asia/Shanghai', instant, 'America/Los_Angeles')
    expect(shFromLA.dayRelation).toBe('tomorrow')
  })

  it('never turns a 1h gap into a 23h difference across midnight', () => {
    // Shanghai 02:00 -> Tokyo 03:00, still only +1h.
    const instant = new Date('2026-07-14T18:00:00Z') // Shanghai 02:00 on 07-15
    const sh = describeZone('Asia/Shanghai', instant, 'Asia/Shanghai')
    expect(sh.localTime).toBe('02:00')
    const tokyo = describeZone('Asia/Tokyo', instant, 'Asia/Shanghai')
    expect(tokyo.differenceMinutes).toBe(60)
    expect(tokyo.dayRelation).toBe('today')
    // And LA is on the previous day but only -15h, not -9h/+9h confusion.
    const la = describeZone('America/Los_Angeles', instant, 'Asia/Shanghai')
    expect(la.differenceMinutes).toBe(-900)
    expect(la.dayRelation).toBe('yesterday')
  })

  it('handles fractional differences', () => {
    const kolkata = describeZone('Asia/Kolkata', SUMMER, 'Asia/Shanghai')
    expect(kolkata.differenceMinutes).toBe(-150)
    const kathmandu = describeZone('Asia/Kathmandu', SUMMER, 'Asia/Shanghai')
    expect(kathmandu.differenceMinutes).toBe(-135)
  })

  it('is symmetric', () => {
    const a = describeZone('Europe/London', SUMMER, 'Asia/Tokyo')
    const b = describeZone('Asia/Tokyo', SUMMER, 'Europe/London')
    expect(a.differenceMinutes).toBe(-b.differenceMinutes)
  })
})

describe('formatDifference', () => {
  it('renders Chinese difference strings', () => {
    expect(formatDifference(0, '上海')).toBe('与上海相同')
    expect(formatDifference(-420, '上海')).toBe('慢 7 小时')
    expect(formatDifference(60, '上海')).toBe('快 1 小时')
    expect(formatDifference(150, '上海')).toBe('快 2 小时 30 分')
    expect(formatDifference(-210, '上海')).toBe('慢 3 小时 30 分')
    expect(formatDifference(-45, '上海')).toBe('慢 45 分')
  })

  it('renders compact differences', () => {
    expect(formatDifferenceShort(0)).toBe('同步')
    expect(formatDifferenceShort(-420)).toBe('-7h')
    expect(formatDifferenceShort(330)).toBe('+5h30m')
  })
})

describe('instantFromZonedWallClock', () => {
  it('does not reinterpret years below 100 as 1900-based dates', () => {
    const instant = instantFromZonedWallClock('UTC', 42, 6, 15, 9, 30)
    expect(instant.toISOString()).toBe('0042-06-15T09:30:00.000Z')
    expect(offsetMinutes('UTC', instant)).toBe(0)
    expect(describeZone('UTC', instant, 'UTC').date).toBe('0042-06-15')
  })

  it('rejects invalid calendar fields instead of treating them as a DST gap', () => {
    expect(() => resolveZonedWallClock('UTC', 2026, 2, 30, 10, 0)).toThrow(RangeError)
    expect(() => resolveZonedWallClock('UTC', 2026, 1, 15, 24, 0)).toThrow(RangeError)
    expect(() => resolveZonedWallClock('UTC', 2026, 1, 15, 9, 60)).toThrow(RangeError)
  })

  it('round-trips wall clock through a zone', () => {
    // Shanghai 2026-12-25 10:00 -> 2026-12-25T02:00Z
    const d = instantFromZonedWallClock('Asia/Shanghai', 2026, 12, 25, 10, 0)
    expect(d.toISOString()).toBe('2026-12-25T02:00:00.000Z')
    const p = zonedParts('Asia/Shanghai', d)
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 12, 25, 10, 0])
  })

  it('round-trips in a DST zone on both sides of the transition', () => {
    for (const [y, mo, dd, hh] of [
      [2026, 1, 15, 9],
      [2026, 7, 15, 9],
    ] as const) {
      const d = instantFromZonedWallClock('Europe/London', y, mo, dd, hh, 30)
      const p = zonedParts('Europe/London', d)
      expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([y, mo, dd, hh, 30])
    }
  })

  it('shifts a non-existent local time FORWARD past the DST gap', () => {
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 -> 03:00).
    // A naive offset loop landed on 01:30 — an hour *before* what was asked,
    // silently recomputing every city from the wrong instant.
    const r = resolveZonedWallClock('America/New_York', 2026, 3, 8, 2, 30)
    expect(r.resolution).toBe('gap')
    const p = zonedParts('America/New_York', r.instant)
    expect([p.hour, p.minute]).toEqual([3, 30])

    // Europe used to shift the other way; both must now go forward.
    const ldn = resolveZonedWallClock('Europe/London', 2026, 3, 29, 1, 30)
    expect(ldn.resolution).toBe('gap')
    const lp = zonedParts('Europe/London', ldn.instant)
    expect([lp.hour, lp.minute]).toEqual([2, 30])

    // Southern hemisphere transition too.
    const syd = resolveZonedWallClock('Australia/Sydney', 2026, 10, 4, 2, 30)
    const sp = zonedParts('Australia/Sydney', syd.instant)
    expect([sp.hour, sp.minute]).toEqual([3, 30])
  })

  it('resolves a repeated local time to the earlier instant', () => {
    // 2026-11-01 01:30 happens twice in New York; take the first pass (EDT).
    const r = resolveZonedWallClock('America/New_York', 2026, 11, 1, 1, 30)
    expect(r.resolution).toBe('ambiguous')
    expect(offsetMinutes('America/New_York', r.instant)).toBe(-240)
    const p = zonedParts('America/New_York', r.instant)
    expect([p.hour, p.minute]).toEqual([1, 30])
  })

  it('flags gaps only for times that really do not exist', () => {
    const zones = [
      'Asia/Shanghai', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
      'Australia/Sydney', 'Asia/Kathmandu', 'America/St_Johns', 'Pacific/Chatham',
      'Asia/Tehran', 'Europe/Dublin', 'Asia/Kolkata', 'Pacific/Auckland',
    ]
    const bad: string[] = []
    for (const z of zones) {
      for (let mo = 1; mo <= 12; mo++) {
        for (const [dd, hh] of [[1, 0], [10, 9], [15, 14], [20, 18], [28, 23]] as const) {
          const r = resolveZonedWallClock(z, 2026, mo, dd, hh, 30)
          const p = zonedParts(z, r.instant)
          const exact =
            p.year === 2026 && p.month === mo && p.day === dd && p.hour === hh && p.minute === 30
          if (exact && r.resolution === 'gap') bad.push(`${z} ${mo}/${dd} ${hh}:30 false gap`)
          if (!exact && r.resolution === 'exact') bad.push(`${z} ${mo}/${dd} ${hh}:30 wrong exact`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('matches the spec meeting-planner example', () => {
    // Base Shanghai 2026-12-25 10:00 -> London 02:00, New York 21:00 (prev day), Tokyo 11:00
    const base = instantFromZonedWallClock('Asia/Shanghai', 2026, 12, 25, 10, 0)
    const london = describeZone('Europe/London', base, 'Asia/Shanghai')
    const ny = describeZone('America/New_York', base, 'Asia/Shanghai')
    const tokyo = describeZone('Asia/Tokyo', base, 'Asia/Shanghai')
    expect(london.localTime).toBe('02:00')
    expect(ny.localTime).toBe('21:00')
    expect(ny.dayRelation).toBe('yesterday')
    expect(tokyo.localTime).toBe('11:00')
  })
})
