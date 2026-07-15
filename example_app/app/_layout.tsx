import { useColorScheme } from '@/hooks/useColorScheme'
import { initDatabase } from '@/utils/database'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [loaded, fontError] = useFonts({

    // eslint-disable-next-line ts/no-require-imports
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })
  const [appReady, setAppReady] = useState(false)

  useEffect(() => {
    async function prepare() {
      try {
        if (!loaded && !fontError) {
          return
        }

        setAppReady(true)
        await SplashScreen.hideAsync()
      }
      catch (e) {
        console.warn('Error initializing app shell:', e)
        setAppReady(true)
      }
    }

    prepare()
  }, [loaded, fontError])

  useEffect(() => {
    initDatabase().catch((e) => {
      console.warn('Error initializing database:', e)
    })
  }, [])

  if (!appReady) {
    return null
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
