import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Provider } from '../../../ui/provider'
import { JsonViewer } from '../JsonViewer'

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

describe('jsonViewer', () => {
  it('renders JSON viewer component', () => {
    const testValue = { name: 'John Doe', age: 30, active: true }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    // The JsonView component should be rendered with collapsed content
    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    
    // Should show object size information
    expect(screen.getByText('3 items')).toBeInTheDocument()
  })

  it('renders nested JSON objects', () => {
    const testValue = {
      user: {
        profile: {
          name: 'Jane Smith',
          settings: { theme: 'dark', notifications: true },
        },
      },
    }

    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    const itemElements = screen.getAllByText('1 item')
    expect(itemElements.length).toBeGreaterThan(0)
  })

  it('renders arrays in JSON', () => {
    const testValue = { 
      items: ['apple', 'banana', 'cherry'],
      numbers: [1, 2, 3],
    }

    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    expect(screen.getByText('2 items')).toBeInTheDocument()
  })

  it('applies light theme when isDark is false', () => {
    const testValue = { theme: 'light' }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    
    // Should have light theme styles
    expect(jsonContainer).toHaveStyle({ '--w-rjv-background-color': '#ffffff' })
  })

  it('applies dark theme when isDark is true', () => {
    const testValue = { theme: 'dark' }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={true} />
      </TestWrapper>,
    )

    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    
    // Should have dark theme styles  
    expect(jsonContainer).toHaveStyle({ '--w-rjv-background-color': '#202020' })
  })

  it('handles null values', () => {
    const testValue = { nullValue: null }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    expect(screen.getAllByText('1 item')).toHaveLength(1)
  })

  it('handles undefined values', () => {
    const testValue = { undefinedValue: undefined }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    // Component should render without crashing
    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
  })

  it('handles empty objects', () => {
    const testValue = {}
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    // Empty object should still render the container
    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
  })

  it('handles complex mixed data types', () => {
    const testValue = {
      string: 'hello',
      number: 42,
      boolean: false,
      array: [1, 'two', { three: 3 }],
      nested: {
        date: '2024-01-01',
        scores: [95, 87, 92],
      },
    }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
    expect(screen.getByText('5 items')).toBeInTheDocument()
  })

  it('renders with proper container styling', () => {
    const testValue = { test: 'value' }
    
    render(
      <TestWrapper>
        <JsonViewer value={testValue} isDark={false} />
      </TestWrapper>,
    )

    // Check that the container box is rendered
    const containerBox = document.querySelector('[class*="css-"]')
    expect(containerBox).toBeInTheDocument()
    
    const jsonContainer = document.querySelector('.w-json-view-container')
    expect(jsonContainer).toBeInTheDocument()
  })
}) 
