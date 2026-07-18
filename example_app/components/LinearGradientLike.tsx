import type { ReactNode } from 'react'
import React from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

interface LinearGradientLikeProps {
  children: ReactNode
  colors: [string, string]
  style?: ViewStyle
}

export function LinearGradientLike({
  children,
  colors,
  style,
}: LinearGradientLikeProps) {
  return (
    <View style={[styles.container, style, { backgroundColor: colors[1] }]}>
      <View style={[styles.glowLarge, { backgroundColor: colors[0] }]} />
      <View style={[styles.glowSmall, { backgroundColor: colors[0] }]} />
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -70,
    right: -40,
    opacity: 0.35,
  },
  glowSmall: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    bottom: -50,
    left: -30,
    opacity: 0.2,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
})
