import { afterEach, describe, expect, it, vi } from 'vitest'

async function load(raw: unknown) {
  vi.resetModules()
  const storage = { getItem: vi.fn(() => JSON.stringify(raw)), setItem: vi.fn() }
  vi.stubGlobal('localStorage', storage)
  const { useStore } = await import('./store')
  return { useStore, storage }
}

afterEach(() => vi.unstubAllGlobals())

describe('persisted preferences', () => {
  it.each([null, [], 42, 'invalid', { pinned: 'invalid', baseTimezone: 42, displayMode: 'unknown' }])('recovers from malformed preferences: %j', async (raw) => {
    const { useStore } = await load(raw)
    const state = useStore.getState()
    expect(state.baseTimezone).toBe('Asia/Shanghai')
    expect(state.displayMode).toBe('iana')
    expect(state.pinned).toContain('shanghai')
  })

  it('removes unknown and duplicate pins without losing valid preferences', async () => {
    const { useStore } = await load({ pinned: ['beijing', 'beijing', 'missing', 3], displayMode: 'utc' })
    expect(useStore.getState().pinned).toEqual(['beijing'])
    expect(useStore.getState().displayMode).toBe('utc')
  })

  it('preserves an intentionally empty pinned list', async () => {
    const { useStore } = await load({ pinned: [] })
    expect(useStore.getState().pinned).toEqual([])
  })

  it('keeps city identity for selection and base changes', async () => {
    const { useStore, storage } = await load({})
    useStore.getState().select('Asia/Shanghai', 'beijing')
    expect(useStore.getState().selectedCityId).toBe('beijing')
    useStore.getState().setBase('Asia/Shanghai', 'beijing')
    expect(useStore.getState()).toMatchObject({ baseCityId: 'beijing', selectedTimezone: null, selectedCityId: null })
    expect(JSON.parse(storage.setItem.mock.lastCall![1]).baseCityId).toBe('beijing')
  })

  it('rejects mismatched persisted base city and timezone', async () => {
    const { useStore } = await load({ baseTimezone: 'Asia/Tokyo', baseCityId: 'beijing' })
    expect(useStore.getState().baseCityId).toBe('tokyo')
  })
})
