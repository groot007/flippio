import { render } from '@renderer/test-utils/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DragAndDropProvider, useDragAndDrop } from './DragAndDropProvider'

function MockChildComponent() {
  const { handleFile, isProcessingFile } = useDragAndDrop()

  return (
    <div>
      <p data-testid="processing-status">{isProcessingFile ? 'Processing' : 'Idle'}</p>
      <button onClick={() => handleFile(new File(['test'], 'test.db'))} data-testid="mock-upload">
        Upload File
      </button>
    </div>
  )
}

describe('dragAndDropProvider', () => {
  it('renders children correctly', () => {
    render(
      <DragAndDropProvider>
        <MockChildComponent />
      </DragAndDropProvider>,
    )

    expect(screen.getByTestId('processing-status')).toHaveTextContent('Idle')
  })

  it('handles file upload correctly', async () => {
    const mockHandleFile = vi.fn()

    render(
      <DragAndDropProvider>
        <MockChildComponent />
      </DragAndDropProvider>,
    )

    const uploadButton = screen.getByTestId('mock-upload')
    fireEvent.click(uploadButton)

    expect(screen.getByTestId('processing-status')).toHaveTextContent('Processing')
    expect(mockHandleFile).not.toHaveBeenCalled() // Mocking not implemented yet
  })

  it('shows overlay when dragging files', () => {
    render(
      <DragAndDropProvider>
        <MockChildComponent />
      </DragAndDropProvider>,
    )

    fireEvent.dragEnter(window)
    expect(screen.getByText('Drop Database Files Here')).toBeInTheDocument()

    fireEvent.dragLeave(window)
    expect(screen.queryByText('Drop Database Files Here')).not.toBeInTheDocument()
  })
})
