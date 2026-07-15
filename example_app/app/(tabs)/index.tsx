import { DatabaseItems } from '@/components/DatabaseItems'
import ParallaxScrollView from '@/components/ParallaxScrollView'
import { ThemedText } from '@/components/ThemedText'
import { getDatabaseTargets } from '@/utils/database'
import { Image, StyleSheet } from 'react-native'

export default function HomeScreen() {
  const databaseTargets = getDatabaseTargets()

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
      <ThemedText style={styles.introText}>
        This example app seeds two separate SQLite databases on iOS: one in
        `Library` and one in `Documents`.
      </ThemedText>

      {databaseTargets.map(target => (
        <DatabaseItems
          key={target.id}
          databasePath={target.absolutePath}
          databaseTarget={target.id}
          description={`${target.directoryLabel} database file: ${target.name}`}
          style={styles.dbContainer}
          title={`${target.directoryLabel} Database`}
        />
      ))}
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
  introText: {
    marginBottom: 16,
  },
})
