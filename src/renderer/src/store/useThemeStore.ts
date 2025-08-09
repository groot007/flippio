import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark-modern' | 'dark-warm'

export interface ThemeInfo {
  name: string
  description: string
  preview: {
    bg: string
    text: string
    accent: string
  }
}

export const THEMES: Record<ThemeMode, ThemeInfo> = {
  'light': {
    name: 'Light',
    description: 'Clean and bright interface',
    preview: {
      bg: '#FFFFFF',
      text: '#202124',
      accent: '#2AF5C9',
    },
  },
  'dark-modern': {
    name: 'Dark Modern',
    description: 'Sleek dark theme with teal accents',
    preview: {
      bg: '#0D1117',
      text: '#F0F6FC',
      accent: '#2AF5C9',
    },
  },
  'dark-warm': {
    name: 'Dark Warm',
    description: 'Cozy dark theme with warm teal accents',
    preview: {
      bg: '#1A1625',
      text: '#EDE9FE',
      accent: '#4FD1C7',
    },
  },
}

interface ThemeStore {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  getThemeInfo: (theme: ThemeMode) => ThemeInfo
  getAllThemes: () => Array<{ mode: ThemeMode, info: ThemeInfo }>
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, _get) => ({
      theme: 'light',
      
      setTheme: (theme: ThemeMode) => {
        set({ theme })
        
        const body = document.body
        body.classList.remove('theme-light', 'theme-dark-modern', 'theme-dark-warm')
        body.classList.add(`theme-${theme}`)
        
        if (theme === 'light') {
          body.classList.remove('dark')
          body.setAttribute('data-theme', 'light')
          body.removeAttribute('data-theme-variant')
        }
        else if (theme === 'dark-modern') {
          body.classList.add('dark')
          body.setAttribute('data-theme', 'dark')
          body.setAttribute('data-theme-variant', 'modern')
        }
        else if (theme === 'dark-warm') {
          body.classList.add('dark')
          body.setAttribute('data-theme', 'dark')
          body.setAttribute('data-theme-variant', 'warm')
        }
      },
      
      getThemeInfo: (theme: ThemeMode) => THEMES[theme],
      
      getAllThemes: () => 
        Object.entries(THEMES).map(([mode, info]) => ({
          mode: mode as ThemeMode,
          info,
        })),
    }),
    {
      name: 'flippio-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          const body = document.body
          body.classList.remove('theme-light', 'theme-dark-modern', 'theme-dark-warm')
          body.classList.add(`theme-${state.theme}`)
          
          if (state.theme === 'light') {
            body.classList.remove('dark')
            body.setAttribute('data-theme', 'light')
            body.removeAttribute('data-theme-variant')
          }
          else if (state.theme === 'dark-modern') {
            body.classList.add('dark')
            body.setAttribute('data-theme', 'dark')
            body.setAttribute('data-theme-variant', 'modern')
          }
          else if (state.theme === 'dark-warm') {
            body.classList.add('dark')
            body.setAttribute('data-theme', 'dark')
            body.setAttribute('data-theme-variant', 'warm')
          }
        }
      },
    },
  ),
)
