import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from './GradientBackground';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  title: string;
  subtitle?: string;
  gradient?: readonly [string, string, ...string[]];
  headerRight?: React.ReactNode;
  background?: readonly [string, string, ...string[]];
  refreshing?: boolean;
  onRefresh?: () => void;
  /** When true, the children are rendered without an internal ScrollView (use for FlatList screens). */
  scroll?: boolean;
  contentStyle?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
};

/**
 * Standard screen shell used by every tab / sub-route:
 * - soft gradient background
 * - gradient hero header with title + subtitle
 * - optional pull-to-refresh
 */
export function Screen({
  title,
  subtitle,
  gradient,
  headerRight,
  background = ['#eef2ff', '#f5f3ff', '#fdf2f8'] as const,
  refreshing,
  onRefresh,
  scroll = true,
  contentStyle,
  children,
}: Props) {
  return (
    <GradientBackground colors={background}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle as any]}
            refreshControl={
              onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#6366f1" /> : undefined
            }
          >
            <ScreenHeader title={title} subtitle={subtitle} gradient={gradient} right={headerRight} />
            <View style={{ marginTop: 16 }}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle as any]}>
            <ScreenHeader title={title} subtitle={subtitle} gradient={gradient} right={headerRight} />
            <View style={{ flex: 1, marginTop: 16 }}>{children}</View>
          </View>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40 },
});
