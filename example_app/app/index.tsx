import { DatabaseItems } from '@/components/DatabaseItems'
import { useColorScheme } from '@/hooks/useColorScheme'
import { LinearGradientLike } from '@/components/LinearGradientLike'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'

export default function HomeScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#0D141A' : '#F4F7F2' }]}>
      <ThemedView style={styles.container}>
        <View style={styles.heroWrap}>
          <LinearGradientLike
            colors={isDark ? ['#16313F', '#0D141A'] : ['#D8F1E1', '#F4F7F2']}
            style={styles.heroCard}
          >
            <View style={styles.heroEyebrowRow}>
              <View style={[styles.heroDot, { backgroundColor: isDark ? '#8CE0B8' : '#1F7A57' }]} />
              <ThemedText style={styles.eyebrow}>Flippio Example App</ThemedText>
            </View>

            <ThemedText type="title" style={styles.title}>
              SQLite files, clear and visible
            </ThemedText>

            <ThemedText style={styles.subtitle}>
              Each section below maps to one database file. You can see the file name, full path,
              row count, and actual records in one place.
            </ThemedText>
          </LinearGradientLike>
        </View>

        <DatabaseItems style={styles.databaseItems} />
      </ThemedView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  heroWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.78,
  },
  title: {
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.82,
  },
  databaseItems: {
    flex: 1,
  },
})
