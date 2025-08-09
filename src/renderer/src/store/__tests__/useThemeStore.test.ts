import { beforeEach, describe, expect, it, vi } from 'vitest'
import { THEMES, useThemeStore } from '../useThemeStore'

vi.mock('@tauri-apps/api/app', () => ({
  getName: vi.fn().mockResolvedValue('Flippio'),
  getVersion: vi.fn().mockResolvedValue('1.0.0'),
}))

vi.mock('@tauri-apps/api/os', () => ({
  platform: vi.fn().mockResolvedValue('darwin'),
}))

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({
      theme: 'light',
    })
    
    document.body.className = ''
    document.body.removeAttribute('data-theme')
    document.body.removeAttribute('data-theme-variant')
    
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const state = useThemeStore.getState()
    expect(state.theme).toBe('light')
  })

  describe('theme switching', () => {
    it('should switch to light theme', () => {
      const { setTheme } = useThemeStore.getState()
      
      setTheme('light')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('light')
      expect(document.body.classList.contains('theme-light')).toBe(true)
      expect(document.body.classList.contains('dark')).toBe(false)
      expect(document.body.getAttribute('data-theme')).toBe('light')
    })

    it('should switch to dark-modern theme', () => {
      const { setTheme } = useThemeStore.getState()
      
      setTheme('dark-modern')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark-modern')
      expect(document.body.classList.contains('theme-dark-modern')).toBe(true)
      expect(document.body.classList.contains('dark')).toBe(true)
      expect(document.body.getAttribute('data-theme')).toBe('dark')
      expect(document.body.getAttribute('data-theme-variant')).toBe('modern')
    })

    it('should switch to dark-warm theme', () => {
      const { setTheme } = useThemeStore.getState()
      
      setTheme('dark-warm')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark-warm')
      expect(document.body.classList.contains('theme-dark-warm')).toBe(true)
      expect(document.body.classList.contains('dark')).toBe(true)
      expect(document.body.getAttribute('data-theme')).toBe('dark')
      expect(document.body.getAttribute('data-theme-variant')).toBe('warm')
    })

    it('should remove previous theme classes when switching', () => {
      const { setTheme } = useThemeStore.getState()
      
      setTheme('dark-modern')
      expect(document.body.classList.contains('theme-dark-modern')).toBe(true)
      
      setTheme('light')
      expect(document.body.classList.contains('theme-dark-modern')).toBe(false)
      expect(document.body.classList.contains('theme-light')).toBe(true)
    })
  })

  describe('theme information', () => {
    it('should get theme info for light theme', () => {
      const { getThemeInfo } = useThemeStore.getState()
      
      const info = getThemeInfo('light')
      
      expect(info).toEqual(THEMES.light)
      expect(info.name).toBe('Light')
      expect(info.description).toBe('Clean and bright interface')
    })

    it('should get theme info for dark-modern theme', () => {
      const { getThemeInfo } = useThemeStore.getState()
      
      const info = getThemeInfo('dark-modern')
      
      expect(info).toEqual(THEMES['dark-modern'])
      expect(info.name).toBe('Dark Modern')
      expect(info.description).toBe('Sleek dark theme with teal accents')
    })

    it('should get theme info for dark-warm theme', () => {
      const { getThemeInfo } = useThemeStore.getState()
      
      const info = getThemeInfo('dark-warm')
      
      expect(info).toEqual(THEMES['dark-warm'])
      expect(info.name).toBe('Dark Warm')
      expect(info.description).toBe('Cozy dark theme with warm teal accents')
    })

    it('should get all themes', () => {
      const { getAllThemes } = useThemeStore.getState()
      
      const allThemes = getAllThemes()
      
      expect(allThemes).toHaveLength(3)
      expect(allThemes[0]).toEqual({ mode: 'light', info: THEMES.light })
      expect(allThemes[1]).toEqual({ mode: 'dark-modern', info: THEMES['dark-modern'] })
      expect(allThemes[2]).toEqual({ mode: 'dark-warm', info: THEMES['dark-warm'] })
    })
  })

  describe('theme persistence', () => {
    it('should persist theme changes', () => {
      const { setTheme } = useThemeStore.getState()
      
      setTheme('dark-modern')
      
      const newState = useThemeStore.getState()
      expect(newState.theme).toBe('dark-modern')
    })
  })

  describe('edge cases', () => {
    it('should handle rapid theme changes', () => {
      const { setTheme } = useThemeStore.getState()
      
      setTheme('light')
      setTheme('dark-modern')
      setTheme('dark-warm')
      setTheme('light')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('light')
      expect(document.body.classList.contains('theme-light')).toBe(true)
      expect(document.body.classList.contains('theme-dark-modern')).toBe(false)
      expect(document.body.classList.contains('theme-dark-warm')).toBe(false)
    })

    it('should maintain theme info consistency', () => {
      const { getThemeInfo, getAllThemes } = useThemeStore.getState()
      
      const lightInfo = getThemeInfo('light')
      const allThemes = getAllThemes()
      const lightFromAll = allThemes.find(t => t.mode === 'light')
      
      expect(lightInfo).toEqual(lightFromAll?.info)
    })
  })
})
