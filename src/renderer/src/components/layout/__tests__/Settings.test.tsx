import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '../../../test-utils/render'
import { Settings } from '../Settings'

const mocks = vi.hoisted(() => ({
  checkForUpdates: vi.fn(),
  downloadAndInstall: vi.fn(),
  toasterCreate: vi.fn(),
}))

vi.mock('@renderer/hooks/useAutoUpdater', () => ({
  useAutoUpdater: () => ({
    isChecking: false,
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
    mocks.checkForUpdates.mockResolvedValue({ data: { available: false } })
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
})
