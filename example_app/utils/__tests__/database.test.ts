jest.mock('@op-engineering/op-sqlite', () => ({
  ANDROID_DATABASE_PATH: '/android/databases',
  IOS_LIBRARY_PATH: '/ios/Library',
  open: jest.fn(() => ({
    closeAsync: jest.fn(),
    execute: jest.fn(),
  })),
}))

jest.mock('expo-constants', () => ({
  expoConfig: {
    ios: {
      bundleIdentifier: 'com.example.flippio',
    },
  },
}))

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///ios/Documents/',
}))

import { openDatabase } from '../database'

const { open: mockOpen } = jest.requireMock('@op-engineering/op-sqlite') as {
  open: jest.Mock
}

describe('openDatabase', () => {
  beforeEach(() => {
    mockOpen.mockClear()
  })

  it('opens the SQLCipher fixture with its encryption key', async () => {
    await openDatabase('sqlcipher_items_sample.db', '/ios/Library/SQLite')

    expect(mockOpen).toHaveBeenCalledWith({
      name: 'sqlcipher_items_sample.db',
      location: '/ios/Library/SQLite',
      encryptionKey: 'flippio-secret',
    })
  })

  it('opens a normal fixture without an encryption key', async () => {
    await openDatabase('flippio.db', '/ios/Library/SQLite')

    expect(mockOpen).toHaveBeenCalledWith({
      name: 'flippio.db',
      location: '/ios/Library/SQLite',
    })
  })
})
