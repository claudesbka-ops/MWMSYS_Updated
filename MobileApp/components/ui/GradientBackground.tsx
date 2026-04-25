import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  colors?: readonly [string, string, ...string[]];
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
};

/**
 * Full-bleed gradient backdrop for auth / hero screens.
 * Default is the soft indigo→violet→pink "auth" wash.
 */
export function GradientBackground({
  colors = ['#eef2ff', '#f5f3ff', '#fdf2f8'] as const,
  style,
  children,
}: Props) {
  return (
    <LinearGradient colors={colors as any} style={[styles.fill, style as any]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
