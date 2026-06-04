'use client'

import type { IconButtonProps, SpanProps } from '@chakra-ui/react'
import type { ThemeProviderProps } from 'next-themes'
import { ClientOnly, HStack, IconButton, Skeleton, Span } from '@chakra-ui/react'
import { ThemeProvider, useTheme } from 'next-themes'
import * as React from 'react'
import { LuMoon, LuSun } from 'react-icons/lu'

export interface ColorModeProviderProps extends ThemeProviderProps {}

export function ColorModeProvider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    />
  )
}

export type ColorMode = 'light' | 'dark'

export interface UseColorModeReturn {
  colorMode: ColorMode
  setColorMode: (colorMode: ColorMode) => void
  toggleColorMode: () => void
}

export function useColorMode(): UseColorModeReturn {
  const { resolvedTheme, setTheme } = useTheme()
  const toggleColorMode = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  return {
    colorMode: resolvedTheme as ColorMode,
    setColorMode: setTheme,
    toggleColorMode,
  }
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode()
  return colorMode === 'dark' ? dark : light
}

export function ColorModeIcon() {
  const { colorMode } = useColorMode()
  return colorMode === 'dark' ? <LuMoon /> : <LuSun />
}

interface ColorModeButtonProps extends Omit<IconButtonProps, 'aria-label'> {}

export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>((props, ref) => {
  const { toggleColorMode } = useColorMode()
  return (
    <ClientOnly fallback={<Skeleton boxSize="8" />}>
      <IconButton
        onClick={toggleColorMode}
        variant="ghost"
        aria-label="Toggle color mode"
        size="sm"
        ref={ref}
        color="textSecondary"
        _hover={{
          bg: 'bgTertiary',
          color: 'flipioPrimary',
        }}
        {...props}
        css={{
          _icon: {
            width: '4',
            height: '4',
          },
        }}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  )
})

export function ColorModeSwitcher() {
  const { colorMode, setColorMode } = useColorMode()

  return (
    <ClientOnly fallback={<Skeleton height="7" width="14" borderRadius="full" />}>
      <HStack
        gap={1}
        p="2px"
        borderRadius="full"
        border="1px solid"
        borderColor="borderSecondary"
        bg="bgSecondary"
      >
        <IconButton
          aria-label="Use light theme"
          aria-pressed={colorMode === 'light'}
          size="xs"
          variant="ghost"
          borderRadius="full"
          color={colorMode === 'light' ? 'white' : 'textSecondary'}
          bg={colorMode === 'light' ? 'flipioPrimary' : 'transparent'}
          _hover={{
            bg: colorMode === 'light' ? 'flipioPrimary' : 'bgTertiary',
            color: colorMode === 'light' ? 'white' : 'flipioPrimary',
          }}
          onClick={() => setColorMode('light')}
        >
          <LuSun />
        </IconButton>
        <IconButton
          aria-label="Use dark theme"
          aria-pressed={colorMode === 'dark'}
          size="xs"
          variant="ghost"
          borderRadius="full"
          color={colorMode === 'dark' ? 'white' : 'textSecondary'}
          bg={colorMode === 'dark' ? 'flipioPrimary' : 'transparent'}
          _hover={{
            bg: colorMode === 'dark' ? 'flipioPrimary' : 'bgTertiary',
            color: colorMode === 'dark' ? 'white' : 'flipioPrimary',
          }}
          onClick={() => setColorMode('dark')}
        >
          <LuMoon />
        </IconButton>
      </HStack>
    </ClientOnly>
  )
}

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  (props, ref) => {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme light"
        colorPalette="gray"
        colorScheme="light"
        ref={ref}
        {...props}
      />
    )
  },
)

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  (props, ref) => {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme dark"
        colorPalette="gray"
        colorScheme="dark"
        ref={ref}
        {...props}
      />
    )
  },
)
