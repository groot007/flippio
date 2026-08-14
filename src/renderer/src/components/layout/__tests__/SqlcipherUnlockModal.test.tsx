import { useSqlcipherUnlock } from '@renderer/store/useSqlcipherUnlock'
import { fireEvent, render, screen, waitFor } from '@renderer/test-utils/render'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SqlcipherUnlockModal } from '../SqlcipherUnlockModal'

const databaseFile = {
  path: '/tmp/encrypted.db',
  filename: 'encrypted.db',
  packageName: '',
  location: '/tmp/encrypted.db',
  remotePath: '/tmp/encrypted.db',
  deviceType: 'desktop' as const,
}

describe('sqlcipherUnlockModal', () => {
  beforeEach(() => {
    useSqlcipherUnlock.setState({
      error: null,
      isSubmitting: false,
      keyByIdentifier: {},
      request: null,
    })
    vi.mocked(window.api.openDatabase).mockReset()
  })

  it('keeps the prompt open and forgets a rejected key', async () => {
    window.api.openDatabase = vi.fn().mockResolvedValue({
      success: false,
      requiresKey: true,
      encryptionState: 'unknown',
      error: 'Invalid SQLCipher key, unsupported encryption settings, or invalid database',
    })
    useSqlcipherUnlock.getState().setRequest({ databaseFile, onUnlocked: vi.fn() })

    render(<SqlcipherUnlockModal />)
    fireEvent.change(screen.getByPlaceholderText('SQLCipher key'), { target: { value: 'wrong-key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText(/Invalid SQLCipher key/)).toBeInTheDocument()
    expect(useSqlcipherUnlock.getState().request).not.toBeNull()
    expect(useSqlcipherUnlock.getState().keyByIdentifier).toEqual({})
  })

  it('keeps the prompt open when post-unlock selection fails', async () => {
    window.api.openDatabase = vi.fn().mockResolvedValue({
      success: true,
      path: databaseFile.path,
      requiresKey: false,
      encryptionState: 'sqlcipher',
    })
    const onUnlocked = vi.fn().mockRejectedValue(new Error('Could not refresh device database'))
    useSqlcipherUnlock.getState().setRequest({ databaseFile, onUnlocked })

    render(<SqlcipherUnlockModal />)
    fireEvent.change(screen.getByPlaceholderText('SQLCipher key'), { target: { value: 'correct-key' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText('Could not refresh device database')).toBeInTheDocument()
    await waitFor(() => expect(useSqlcipherUnlock.getState().request).not.toBeNull())
  })
})
