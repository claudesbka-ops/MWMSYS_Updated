import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  gradient?: readonly [string, string, ...string[]];
  onPress?: () => void;
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
};

const ACCENTS: Record<NonNullable<Props['accent']>, readonly [string, string]> = {
  indigo: ['#6366f1', '#8b5cf6'],
  emerald: ['#10b981', '#34d399'],
  amber: ['#f59e0b', '#fb923c'],
  rose: ['#f43f5e', '#ec4899'],
  sky: ['#0ea5e9', '#22d3ee'],
  violet: ['#a855f7', '#ec4899'],
};

/**
 * KPI tile with a small gradient icon chip + big value + muted label.
 */
export function StatCard({ label, value, icon, gradient, onPress, accent = 'indigo' }: Props) {
  const colors = gradient ?? ACCENTS[accent];
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconChip}>
          <FontAwesome name={icon ?? 'circle'} size={14} color="white" />
        </LinearGradient>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.value}>{String(value)}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.08)',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconChip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 11, fontWeight: '700', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.3, textTransform: 'uppercase' },
  value: { marginTop: 10, fontSize: 22, fontWeight: '800', color: '#0f172a' },
});
