import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type CardProps = {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
  elevated?: boolean;
  tight?: boolean;
};

/**
 * Modern white card with soft indigo shadow + subtle top-to-bottom gradient.
 * Replaces the bland flat `backgroundColor: theme.card, borderColor: theme.border`
 * blocks that made the old UI look "black / blue / white".
 */
export function Card({ style, children, elevated = true, tight = false }: CardProps) {
  return (
    <View style={[styles.wrap, elevated && styles.elevated, style as any]}>
      <LinearGradient
        colors={["#ffffff", "#f8faff"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.inner, tight && styles.tight]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

type GradientCardProps = CardProps & {
  colors: readonly [string, string, ...string[]];
};

/**
 * Full-bleed colored gradient card (used for hero / "premium" sections).
 */
export function GradientCard({ colors, style, children, elevated = true, tight = false }: GradientCardProps) {
  return (
    <View style={[styles.wrap, elevated && styles.elevatedStrong, style as any]}>
      <LinearGradient
        colors={colors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.inner, tight && styles.tight]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.08)',
    backgroundColor: '#ffffff',
  },
  elevated: Platform.select({
    ios: {
      shadowColor: '#4f46e5',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 3 },
    default: {},
  }) as ViewStyle,
  elevatedStrong: Platform.select({
    ios: {
      shadowColor: '#4f46e5',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 22,
    },
    android: { elevation: 6 },
    default: {},
  }) as ViewStyle,
  inner: { padding: 18 },
  tight: { padding: 12 },
});
