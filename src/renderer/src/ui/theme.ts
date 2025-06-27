import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// macOS-inspired color system
const colors = {
  // Primary blue - macOS system blue
  flipioBlue: {
    50: { value: '#EBF8FF' },
    100: { value: '#BEE3F8' },
    200: { value: '#90CDF4' },
    300: { value: '#63B3ED' },
    400: { value: '#4299E1' },
    500: { value: '#007AFF' }, // macOS light blue
    600: { value: '#0066CC' },
    700: { value: '#0A84FF' }, // macOS dark blue
    800: { value: '#1E3A8A' },
    900: { value: '#1E40AF' },
  },
  // macOS gray scale
  flipioGray: {
    50: { value: '#F9FAFB' },
    100: { value: '#F2F2F7' }, // macOS light gray
    200: { value: '#E5E5EA' }, // macOS separator
    300: { value: '#D1D1D6' }, // macOS tertiary label
    400: { value: '#C7C7CC' }, // macOS quaternary label
    500: { value: '#AEAEB2' }, // macOS placeholder
    600: { value: '#8E8E93' }, // macOS secondary label
    700: { value: '#6D6D70' },
    800: { value: '#48484A' }, // macOS label (dark)
    900: { value: '#1C1C1E' }, // macOS background (dark)
  },
  // Dark mode backgrounds
  flipioDark: {
    100: { value: '#000000' }, // macOS pure black
    200: { value: '#1C1C1E' }, // macOS dark background
    300: { value: '#2C2C2E' }, // macOS elevated background
    400: { value: '#3A3A3C' }, // macOS secondary background
    500: { value: '#48484A' }, // macOS tertiary background
    600: { value: '#636366' }, // macOS quaternary background
  },
  // Light mode backgrounds
  flipioLight: {
    100: { value: '#FFFFFF' }, // macOS pure white
    200: { value: '#F2F2F7' }, // macOS secondary background
    300: { value: '#FFFFFF' }, // macOS elevated background
    400: { value: '#F9F9F9' }, // macOS tertiary background
  },
  // Accent colors
  flipioAccent: {
    green: { value: '#34C759' }, // macOS green
    red: { value: '#FF3B30' }, // macOS red
    orange: { value: '#FF9500' }, // macOS orange
    yellow: { value: '#FFCC00' }, // macOS yellow
    purple: { value: '#AF52DE' }, // macOS purple
    pink: { value: '#FF2D92' }, // macOS pink
  },
}

const flipioTheme = defineConfig({
  theme: {
    tokens: {
      colors,
      fonts: {
        heading: { value: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' },
        body: { value: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' },
      },
      fontSizes: {
        'xs': { value: '11px' }, // Caption
        'sm': { value: '13px' }, // Body
        'md': { value: '15px' }, // Body emphasized
        'lg': { value: '17px' }, // Headline
        'xl': { value: '22px' }, // Title 3
        '2xl': { value: '28px' }, // Title 1
        '3xl': { value: '34px' }, // Large title
      },
      fontWeights: {
        normal: { value: '400' },
        medium: { value: '500' },
        semibold: { value: '600' },
        bold: { value: '700' },
      },
      radii: {
        sm: { value: '6px' }, // Buttons
        md: { value: '8px' }, // Cards
        lg: { value: '12px' }, // Modals
        xl: { value: '16px' }, // Large cards
      },
      spacing: {
        px: { value: '1px' },
        0.5: { value: '2px' },
        1: { value: '4px' },
        2: { value: '8px' },
        3: { value: '12px' },
        4: { value: '16px' },
        5: { value: '20px' },
        6: { value: '24px' },
        8: { value: '32px' },
        10: { value: '40px' },
        12: { value: '48px' },
        16: { value: '64px' },
        20: { value: '80px' },
      },
      shadows: {
        sm: { value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
        md: { value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' },
        lg: { value: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' },
        xl: { value: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' },
      },
    },
    semanticTokens: {
      colors: {
        // Background colors
        bgPrimary: {
          value: {
            base: `{colors.flipioLight.100}`,
            _dark: `{colors.flipioDark.200}`,
          },
        },
        bgSecondary: {
          value: {
            base: `{colors.flipioLight.200}`,
            _dark: `{colors.flipioDark.300}`,
          },
        },
        bgTertiary: {
          value: {
            base: `{colors.flipioLight.400}`,
            _dark: `{colors.flipioDark.400}`,
          },
        },
        // Text colors
        textPrimary: {
          value: {
            base: `{colors.flipioGray.900}`,
            _dark: `{colors.flipioGray.100}`,
          },
        },
        textSecondary: {
          value: {
            base: `{colors.flipioGray.600}`,
            _dark: `{colors.flipioGray.400}`,
          },
        },
        textTertiary: {
          value: {
            base: `{colors.flipioGray.500}`,
            _dark: `{colors.flipioGray.500}`,
          },
        },
        // Brand colors
        flipioPrimary: {
          value: {
            base: `{colors.flipioBlue.500}`,
            _dark: `{colors.flipioBlue.700}`,
          },
        },
        flipioSecondary: {
          value: {
            base: `{colors.flipioBlue.600}`,
            _dark: `{colors.flipioBlue.600}`,
          },
        },
        // Border colors
        borderPrimary: {
          value: {
            base: `{colors.flipioGray.200}`,
            _dark: `{colors.flipioDark.500}`,
          },
        },
        borderSecondary: {
          value: {
            base: `{colors.flipioGray.300}`,
            _dark: `{colors.flipioDark.400}`,
          },
        },
        // Status colors
        success: {
          value: `{colors.flipioAccent.green}`,
        },
        error: {
          value: `{colors.flipioAccent.red}`,
        },
        warning: {
          value: `{colors.flipioAccent.orange}`,
        },
      },
    },
  },
})

export const colorSystem = createSystem(defaultConfig, flipioTheme)
