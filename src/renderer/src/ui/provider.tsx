import { ChakraProvider } from '@chakra-ui/react'
import { ThemeProvider } from 'next-themes'
import { colorSystem } from './theme'

export function Provider(props: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={colorSystem}>
      <ThemeProvider attribute="class" disableTransitionOnChange>
        {props.children}
      </ThemeProvider>
    </ChakraProvider>
  )
}
