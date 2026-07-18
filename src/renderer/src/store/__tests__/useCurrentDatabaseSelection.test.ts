import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCurrentDatabaseSelection } from '../useCurrentDatabaseSelection'

describe('useCurrentDatabaseSelection store', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())
    act(() => {
      result.current.setSelectedDatabaseFile(null)
      result.current.setSelectedDatabaseTable(null)
    })
  })

  it('initializes with null selectedDatabaseFile and selectedDatabaseTable', () => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())

    expect(result.current.selectedDatabaseFile).toBeNull()
    expect(result.current.selectedDatabaseTable).toBeNull()
  })

  it('updates selectedDatabaseFile correctly', () => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())

    const testDatabaseFile = {
      path: '/tmp/test.db',
      filename: 'test.db',
      packageName: 'com.test.app',
      location: 'documents',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDatabaseFile(testDatabaseFile)
    })

    expect(result.current.selectedDatabaseFile).toEqual(testDatabaseFile)
  })

  it('updates selectedDatabaseTable correctly', () => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())

    const testDatabaseTable = {
      name: 'users',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDatabaseTable(testDatabaseTable)
    })

    expect(result.current.selectedDatabaseTable).toEqual(testDatabaseTable)
  })

  it('can clear selectedDatabaseFile by setting to null', () => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())

    const testDatabaseFile = {
      path: '/tmp/test.db',
      filename: 'test.db',
      packageName: 'com.test.app',
      location: 'documents',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDatabaseFile(testDatabaseFile)
    })

    expect(result.current.selectedDatabaseFile).toEqual(testDatabaseFile)

    act(() => {
      result.current.setSelectedDatabaseFile(null)
    })

    expect(result.current.selectedDatabaseFile).toBeNull()
  })

  it('can clear selectedDatabaseTable by setting to null', () => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())

    const testDatabaseTable = {
      name: 'users',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDatabaseTable(testDatabaseTable)
    })

    expect(result.current.selectedDatabaseTable).toEqual(testDatabaseTable)

    act(() => {
      result.current.setSelectedDatabaseTable(null)
    })

    expect(result.current.selectedDatabaseTable).toBeNull()
  })

  it('maintains state across multiple hook calls', () => {
    const testDatabaseFile = {
      path: '/tmp/test.db',
      filename: 'test.db',
      packageName: 'com.test.app',
      location: 'documents',
      deviceType: 'android' as const,
    }

    const { result: result1 } = renderHook(() => useCurrentDatabaseSelection())

    act(() => {
      result1.current.setSelectedDatabaseFile(testDatabaseFile)
    })

    const { result: result2 } = renderHook(() => useCurrentDatabaseSelection())

    expect(result2.current.selectedDatabaseFile).toEqual(testDatabaseFile)
  })

  it('handles multiple state updates correctly', () => {
    const { result } = renderHook(() => useCurrentDatabaseSelection())

    const databaseFile = {
      path: '/tmp/test.db',
      filename: 'test.db',
      packageName: 'com.test.app',
      location: 'documents',
      deviceType: 'android' as const,
    }

    const table1 = {
      name: 'users',
      deviceType: 'android' as const,
    }

    const table2 = {
      name: 'orders',
      deviceType: 'android' as const,
    }

    act(() => {
      result.current.setSelectedDatabaseFile(databaseFile)
      result.current.setSelectedDatabaseTable(table1)
    })

    expect(result.current.selectedDatabaseFile).toEqual(databaseFile)
    expect(result.current.selectedDatabaseTable).toEqual(table1)

    act(() => {
      result.current.setSelectedDatabaseTable(table2)
    })

    expect(result.current.selectedDatabaseFile).toEqual(databaseFile)
    expect(result.current.selectedDatabaseTable).toEqual(table2)
  })
})
