import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatOffset, offsetMinutes, zoneNaming } from './time'

/**
 * Bare abbreviations that denote one specific offset by definition. If a zone
 * is labelled GMT while sitting at UTC+1, the label is simply wrong — this is
 * how the Europe/Dublin bug (negative DST in tzdata) was caught.
 */
const BARE_OFFSETS: Record<string, number> = {
  GMT: 0,
  UTC: 0,
  WET: 0,
  CET: 60,
  EET: 120,
  MSK: 180,
}

const PROBES = [
  '2026-01-15T12:00:00Z',
  '2026-04-15T12:00:00Z',
  '2026-07-15T12:00:00Z',
  '2026-10-15T12:00:00Z',
]

function loadZoneIds(): string[] {
  const geo = JSON.parse(fs.readFileSync('public/data/timezones.json', 'utf8')) as {
    features: { properties: { tzid: string } }[]
  }
  return geo.features.map((f) => f.properties.tzid)
}

describe('every zone in the map data', () => {
  const zones = loadZoneIds()

  it('covers the full timezone-boundary-builder set', () => {
    expect(zones.length).toBeGreaterThan(400)
    for (const z of ['Asia/Shanghai', 'Europe/London', 'America/Los_Angeles', 'Asia/Urumqi']) {
      expect(zones, `missing ${z}`).toContain(z)
    }
  })

  it('never labels a zone with an abbreviation that contradicts its offset', () => {
    const bad: string[] = []
    for (const z of zones) {
      for (const iso of PROBES) {
        const d = new Date(iso)
        let abbr: string
        let off: number
        try {
          abbr = zoneNaming(z, d).abbreviation
          off = offsetMinutes(z, d)
        } catch {
          continue
        }
        const bare = BARE_OFFSETS[abbr]
        if (bare !== undefined && bare !== off) {
          bad.push(`${z} @${iso.slice(0, 7)}: says ${abbr} but is ${formatOffset(off)}`)
        }
        // A "GMT+N" fallback must state the true offset.
        const m = /^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(abbr)
        if (m) {
          const sign = m[1]!.startsWith('-') ? -1 : 1
          const mins = Number(m[1]) * 60 + sign * Number(m[2] ?? 0)
          if (mins !== off) {
            bad.push(`${z} @${iso.slice(0, 7)}: fallback ${abbr} but is ${formatOffset(off)}`)
          }
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('produces a usable abbreviation for every zone', () => {
    const empty: string[] = []
    for (const z of zones) {
      const { abbreviation } = zoneNaming(z, new Date(PROBES[2]!))
      if (!abbreviation || abbreviation.length < 2) empty.push(z)
    }
    expect(empty).toEqual([])
  })

  it('resolves a finite offset within ±14h for every zone', () => {
    const bad: string[] = []
    for (const z of zones) {
      for (const iso of PROBES) {
        const off = offsetMinutes(z, new Date(iso))
        if (!Number.isFinite(off) || off < -720 || off > 840) bad.push(`${z}: ${off}`)
      }
    }
    expect(bad).toEqual([])
  })
})
