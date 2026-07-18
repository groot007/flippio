import { describe, expect, it } from 'vitest'
import { buildUpdatedRecentApps, selectRecentAppsForDevice } from '../recentApps'

describe('recentApps utilities', () => {
  it('adds a new recent app entry for a device', () => {
    const result = buildUpdatedRecentApps(
      [],
      { bundleId: 'com.test.app', name: 'Test App' },
      'device-1',
      'Phone',
      1000,
    )

    expect(result).toEqual([
      {
        bundleId: 'com.test.app',
        name: 'Test App',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 1000,
        useCount: 1,
      },
    ])
  })

  it('updates an existing recent app entry instead of duplicating it', () => {
    const existing = [
      {
        bundleId: 'com.test.app',
        name: 'Old Name',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 1000,
        useCount: 2,
      },
    ]

    const result = buildUpdatedRecentApps(
      existing,
      { bundleId: 'com.test.app', name: 'New Name' },
      'device-1',
      'Phone',
      2000,
    )

    expect(result).toEqual([
      {
        bundleId: 'com.test.app',
        name: 'New Name',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 2000,
        useCount: 3,
      },
    ])
  })

  it('keeps only the 10 most recent apps per device', () => {
    const existing = Array.from({ length: 10 }, (_, index) => ({
      bundleId: `com.test.${index}`,
      name: `App ${index}`,
      deviceId: 'device-1',
      deviceName: 'Phone',
      lastUsed: 1000 + index,
      useCount: 1,
    }))

    const result = buildUpdatedRecentApps(
      existing,
      { bundleId: 'com.test.new', name: 'Newest App' },
      'device-1',
      'Phone',
      5000,
    )

    expect(result).toHaveLength(10)
    expect(result[0].bundleId).toBe('com.test.new')
    expect(result.some(app => app.bundleId === 'com.test.0')).toBe(false)
  })

  it('removes stale entries older than 30 days', () => {
    const now = 40 * 24 * 60 * 60 * 1000
    const existing = [
      {
        bundleId: 'com.test.stale',
        name: 'Stale App',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 0,
        useCount: 1,
      },
      {
        bundleId: 'com.test.fresh',
        name: 'Fresh App',
        deviceId: 'device-2',
        deviceName: 'Tablet',
        lastUsed: now - (5 * 24 * 60 * 60 * 1000),
        useCount: 1,
      },
    ]

    const result = buildUpdatedRecentApps(
      existing,
      { bundleId: 'com.test.current', name: 'Current App' },
      'device-1',
      'Phone',
      now,
    )

    expect(result.some(app => app.bundleId === 'com.test.stale')).toBe(false)
    expect(result.some(app => app.bundleId === 'com.test.fresh')).toBe(true)
    expect(result.some(app => app.bundleId === 'com.test.current')).toBe(true)
  })

  it('returns the top 3 recent apps for one device in recency order', () => {
    const recentApps = [
      {
        bundleId: 'com.test.1',
        name: 'App 1',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 1000,
        useCount: 1,
      },
      {
        bundleId: 'com.test.2',
        name: 'App 2',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 4000,
        useCount: 1,
      },
      {
        bundleId: 'com.test.3',
        name: 'App 3',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 3000,
        useCount: 1,
      },
      {
        bundleId: 'com.test.4',
        name: 'App 4',
        deviceId: 'device-1',
        deviceName: 'Phone',
        lastUsed: 2000,
        useCount: 1,
      },
      {
        bundleId: 'com.other.1',
        name: 'Other App',
        deviceId: 'device-2',
        deviceName: 'Tablet',
        lastUsed: 9000,
        useCount: 1,
      },
    ]

    expect(selectRecentAppsForDevice(recentApps, 'device-1').map(app => app.bundleId)).toEqual([
      'com.test.2',
      'com.test.3',
      'com.test.4',
    ])
  })
})
