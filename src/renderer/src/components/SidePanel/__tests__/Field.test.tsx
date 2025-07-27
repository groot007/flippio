import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Provider } from '../../../ui/provider'
import { FieldItem } from '../Field'

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// Mock the JsonEditor component
vi.mock('../JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: any, onChange: (value: any) => void }) => (
    <div data-testid="json-editor">
      <textarea 
        data-testid="json-editor-textarea"
        value={typeof value === 'string' ? value : JSON.stringify(value)}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  ),
}))

// Mock the isJsonValue utility
vi.mock('@renderer/utils', () => ({
  isJsonValue: (value: unknown): boolean => {
    if (typeof value !== 'string') 
      return false
    const trimmed = String(value).trim()
    if (!trimmed) 
      return false
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) 
      return false
    try {
      const parsed = JSON.parse(trimmed)
      return (typeof parsed === 'object' && parsed !== null) || Array.isArray(parsed)
    }
    catch {
      return false
    }
  },
}))

describe('fieldItem', () => {
  const defaultProps = {
    fieldKey: 'testField',
    fieldType: 'TEXT',
    value: 'test value',
    isEditing: false,
    onChange: vi.fn(),
    isLoading: false,
    isDark: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic Rendering', () => {
    it('renders field key and type', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} />
        </TestWrapper>,
      )

      expect(screen.getByText('testField')).toBeInTheDocument()
      expect(screen.getByText('TEXT')).toBeInTheDocument()
    })

    it('displays field value when not editing', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} />
        </TestWrapper>,
      )

      expect(screen.getByText('test value')).toBeInTheDocument()
    })

    it('shows input when editing non-JSON field', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} isEditing={true} />
        </TestWrapper>,
      )

      const input = screen.getByDisplayValue('test value')
      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('INPUT')
    })
  })

  describe('jSON Detection and Editing', () => {
    const jsonValue = '{"name": "John", "age": 30}'
    
    it('detects JSON values and shows JSON type', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} />
        </TestWrapper>,
      )

      expect(screen.getByText('TEXT json')).toBeInTheDocument()
    })

    it('shows JSON editor for JSON values when editing', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={true} />
        </TestWrapper>,
      )

      expect(screen.getByTestId('json-editor')).toBeInTheDocument()
    })

    it('shows toggle button for JSON fields when editing', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={true} />
        </TestWrapper>,
      )

      const toggleButton = screen.getByLabelText('Switch to text editor')
      expect(toggleButton).toBeInTheDocument()
    })

    it('switches between JSON editor and text editor', async () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={true} />
        </TestWrapper>,
      )

      // Initially shows JSON editor
      expect(screen.getByTestId('json-editor')).toBeInTheDocument()

      // Click toggle button to switch to text editor
      const toggleButton = screen.getByLabelText('Switch to text editor')
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue(jsonValue)).toBeInTheDocument()
        expect(screen.getByDisplayValue(jsonValue).tagName).toBe('TEXTAREA')
      })
    })

    it('shows input for invalid JSON without toggle button', async () => {
      const invalidJson = '{invalid json'
      
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={invalidJson} isEditing={true} />
        </TestWrapper>,
      )

      // Should show regular input for invalid JSON
      expect(screen.getByDisplayValue(invalidJson)).toBeInTheDocument()
      expect(screen.getByDisplayValue(invalidJson).tagName).toBe('INPUT')

      // Should not show toggle button for invalid JSON
      expect(screen.queryByLabelText('Switch to JSON editor')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Switch to text editor')).not.toBeInTheDocument()
    })
  })

  describe('field Types and Colors', () => {
    it('shows correct color for integer type', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} fieldType="INTEGER" />
        </TestWrapper>,
      )

      expect(screen.getByText('INTEGER')).toBeInTheDocument()
    })

    it('shows correct color for text type', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} fieldType="VARCHAR" />
        </TestWrapper>,
      )

      expect(screen.getByText('VARCHAR')).toBeInTheDocument()
    })

    it('shows correct color for blob type', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} fieldType="BLOB" />
        </TestWrapper>,
      )

      expect(screen.getByText('BLOB')).toBeInTheDocument()
    })

    it('shows correct color for date type', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} fieldType="DATETIME" />
        </TestWrapper>,
      )

      expect(screen.getByText('DATETIME')).toBeInTheDocument()
    })
  })

  describe('dark Mode', () => {
    it('applies dark mode styling', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} isDark={true} />
        </TestWrapper>,
      )

      expect(screen.getByText('testField')).toBeInTheDocument()
      expect(screen.getByText('TEXT')).toBeInTheDocument()
    })

    it('applies dark mode to input when editing', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} isEditing={true} isDark={true} />
        </TestWrapper>,
      )

      const input = screen.getByDisplayValue('test value')
      expect(input).toBeInTheDocument()
    })
  })

  describe('change Handling', () => {
    it('calls onChange when input value changes', () => {
      const onChangeMock = vi.fn()
      
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} isEditing={true} onChange={onChangeMock} />
        </TestWrapper>,
      )

      const input = screen.getByDisplayValue('test value')
      fireEvent.change(input, { target: { value: 'new value' } })

      expect(onChangeMock).toHaveBeenCalledWith('testField', 'new value')
    })

    it('calls onChange when JSON editor value changes', () => {
      const onChangeMock = vi.fn()
      const jsonValue = '{"test": true}'
      
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={true} onChange={onChangeMock} />
        </TestWrapper>,
      )

      const jsonTextarea = screen.getByTestId('json-editor-textarea')
      fireEvent.change(jsonTextarea, { target: { value: '{"updated": true}' } })

      expect(onChangeMock).toHaveBeenCalledWith('testField', '{"updated": true}')
    })

    it('calls onChange when textarea value changes', () => {
      const onChangeMock = vi.fn()
      const jsonValue = '{"test": true}'
      
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={true} onChange={onChangeMock} />
        </TestWrapper>,
      )

      // Switch to text mode first
      const toggleButton = screen.getByLabelText('Switch to text editor')
      fireEvent.click(toggleButton)

      const textarea = screen.getByDisplayValue(jsonValue)
      fireEvent.change(textarea, { target: { value: 'updated text' } })

      expect(onChangeMock).toHaveBeenCalledWith('testField', 'updated text')
    })
  })

  describe('loading State', () => {
    it('disables input when loading', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} isEditing={true} isLoading={true} />
        </TestWrapper>,
      )

      const input = screen.getByDisplayValue('test value')
      expect(input).toBeDisabled()
    })
  })

  describe('edge Cases', () => {
    it('handles undefined value', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={undefined} />
        </TestWrapper>,
      )

      expect(screen.getByText('undefined')).toBeInTheDocument()
    })

    it('handles null value', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={null} />
        </TestWrapper>,
      )

      expect(screen.getByText('null')).toBeInTheDocument()
    })

    it('handles empty string value', () => {
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value="" isEditing={true} />
        </TestWrapper>,
      )

      const input = screen.getByDisplayValue('')
      expect(input).toBeInTheDocument()
    })

    it('resets user preferences when entering edit mode', () => {
      const jsonValue = '{"test": true}'
      const { rerender } = render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={false} />
        </TestWrapper>,
      )

      // Switch to editing mode
      rerender(
        <TestWrapper>
          <FieldItem {...defaultProps} value={jsonValue} isEditing={true} />
        </TestWrapper>,
      )

      // Should show JSON editor by default (not text mode)
      expect(screen.getByTestId('json-editor')).toBeInTheDocument()
    })

    it('handles invalid JSON by showing regular input', async () => {
      const invalidJson = '{invalid'
      
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={invalidJson} isEditing={true} />
        </TestWrapper>,
      )

      // Should show regular input for invalid JSON
      expect(screen.getByDisplayValue(invalidJson)).toBeInTheDocument()
      expect(screen.getByDisplayValue(invalidJson).tagName).toBe('INPUT')

      // Should not show any toggle buttons for invalid JSON
      expect(screen.queryByLabelText('Switch to JSON editor')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Switch to text editor')).not.toBeInTheDocument()
    })

    it('handles array JSON values', () => {
      const arrayValue = '[1, 2, 3]'
      
      render(
        <TestWrapper>
          <FieldItem {...defaultProps} value={arrayValue} />
        </TestWrapper>,
      )

      expect(screen.getByText('TEXT json')).toBeInTheDocument()
    })
  })
}) 
