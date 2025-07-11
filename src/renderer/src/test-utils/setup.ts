import { JSDOM } from 'jsdom'
import { beforeAll, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const { window } = new JSDOM()

// IntersectionObserver mock
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}))
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
window.IntersectionObserver = IntersectionObserverMock

// Scroll Methods mock
window.Element.prototype.scrollTo = () => {}
window.Element.prototype.scrollIntoView = () => {}

// requestAnimationFrame mock
window.requestAnimationFrame = cb => setTimeout(cb, 1000 / 60)

// URL object mock
window.URL.createObjectURL = () => 'https://i.pravatar.cc/300'
window.URL.revokeObjectURL = () => {}
window.matchMedia = vi.fn(() => ({
  matches: false,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  media: '',
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as any

// navigator mock
Object.defineProperty(window, 'navigator', {
  value: {
    clipboard: {
      writeText: vi.fn(),
    },
  },
})

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})
