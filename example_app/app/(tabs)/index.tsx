import { DatabaseItems } from '@/components/DatabaseItems'
import ParallaxScrollView from '@/components/ParallaxScrollView'
import { initDatabase } from '@/utils/database'
import { useEffect } from 'react'
import { Image, StyleSheet } from 'react-native'

export default function HomeScreen() {
  // Initialize the database when the component mounts
  useEffect(() => {
    initDatabase().catch((error) => {
      console.error('Failed to initialize database:', error)
    })
  }, [])

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={(
        <Image
          /* eslint-disable ts/no-require-imports */
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      )}
    >
      {/* Database Items Section */}
      <DatabaseItems style={styles.dbContainer} />
    </ParallaxScrollView>
  )
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  dbContainer: {
    marginBottom: 24,
  },
})
