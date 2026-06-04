import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { Settings } from '../Settings'

const PENDING_UPDATE_STORAGE_KEY = 'flippio.pending-update-changelog'

const mocks = vi.hoisted(() => ({
  checkForUpdates: vi.fn(),
  downloadAndInstall: vi.fn(),
  toasterCreate: vi.fn(),
}))

vi.mock('@renderer/hooks/useAutoUpdater', () => ({
  useAutoUpdater: () => ({
    isChecking: false,
    isDownloading: false,
    checkForUpdates: mocks.checkForUpdates,
    downloadAndInstall: mocks.downloadAndInstall,
  }),
}))

vi.mock('@renderer/ui/toaster', () => ({
  toaster: {
    create: mocks.toasterCreate,
  },
}))

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.checkForUpdates.mockResolvedValue({ data: { available: false } })
    mocks.downloadAndInstall.mockResolvedValue(true)
    vi.mocked(globalThis.window.api.exportLogs).mockResolvedValue('/tmp/flippio-logs.txt')
  })

  it('exports logs from settings menu', async () => {
    render(<Settings />)

    fireEvent.click(screen.getByTitle('Settings'))
    fireEvent.click(await screen.findByText('Export Logs'))

    await waitFor(() => {
      expect(globalThis.window.api.exportLogs).toHaveBeenCalledTimes(1)
    })

    expect(mocks.toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Logs Exported',
      }),
    )
  })

  it('shows update modal with changelog before install', async () => {
    mocks.checkForUpdates.mockResolvedValue({
      data: {
        available: true,
        version: '0.4.1',
        notes: 'Bug fixes\nPerformance improvements',
      },
    })

    render(<Settings />)

    fireEvent.click(screen.getByTitle('Settings'))
    fireEvent.click(await screen.findByText('Check for Updates'))

    expect(await screen.findByText('Update Available: 0.4.1')).toBeInTheDocument()
    expect(screen.getByText(content => content.includes('Bug fixes') && content.includes('Performance improvements'))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Install Update' }))

    await waitFor(() => {
      expect(mocks.downloadAndInstall).toHaveBeenCalledTimes(1)
    })

    expect(window.localStorage.getItem(PENDING_UPDATE_STORAGE_KEY)).toContain('0.4.1')
  })

  it('shows post-update changelog modal after restart', async () => {
    window.localStorage.setItem(PENDING_UPDATE_STORAGE_KEY, JSON.stringify({
      version: '0.4.0',
      notes: 'Fresh improvements shipped',
    }))

    render(<Settings />)

    expect(await screen.findByText('Updated to 0.4.0')).toBeInTheDocument()
    expect(screen.getByText('Fresh improvements shipped')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByText('Updated to 0.4.0')).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(PENDING_UPDATE_STORAGE_KEY)).toBeNull()
  })
})
