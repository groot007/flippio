import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// Base colors
const colors = {
  flipioTeal: {
    50: { value: '#e4f7f5' },
    100: { value: '#c9efeb' },
    200: { value: '#9de3db' },
    300: { value: '#70d7cb' },
    400: { value: '#47d5c9' }, // primary.main
    500: { value: '#1193a0' }, // secondary.main
    600: { value: '#006672' }, // secondary.dark
    700: { value: '#005661' },
    800: { value: '#004750' },
    900: { value: '#003840' },
  },
  flipioAqua: {
    100: { value: '#d7fcff' },
    200: { value: '#b0faff' },
    300: { value: '#79ffff' }, // primary.light
    400: { value: '#56c3d1' }, // secondary.light
    500: { value: '#47d5c9' },
    600: { value: '#1193a0' },
  },
  fliplightGray: {
    50: { value: '#f5f5f5' }, // background.default (light)
    100: { value: '#eeeeee' },
    200: { value: '#e0e0e0' },
    300: { value: '#dddddd' },
    400: { value: '#cccccc' },
  },
  flipdarkGray: {
    700: { value: '#444444' },
    800: { value: '#1e1e1e' }, // background.paper (dark)
    900: { value: '#121212' }, // background.default (dark)
  },
}

const flipioTheme = defineConfig({
  theme: {
    tokens: {
      colors,
    },
    semanticTokens: {
      colors: {
        bgPrimary: {
          value: {
            base: `{colors.fliplightGray.50}`,
            _dark: `{colors.flipdarkGray.900}`,
          },
        },
        bgSecondary: {
          value: {
            base: `{colors.fliplightGray.100}`,
            _dark: `{colors.flipdarkGray.800}`,
          },
        },
        flipioPrimary: {
          value: {
            base: `{colors.flipioAqua.300}`,
            _dark: `{colors.flipioTeal.500}`,
          },
        },
        flipioSecondary: {
          value: {
            base: `{colors.flipioAqua.400}`,
            _dark: `{colors.flipioTeal.600}`,
          },
        },
      },
    },
  },
})

export const colorSystem = createSystem(defaultConfig, flipioTheme)
