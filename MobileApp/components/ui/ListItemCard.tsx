import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type Badge = {
  label: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate' | 'sky';
};

type Props = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  iconGradient?: readonly [string, string, ...string[]];
  badge?: Badge;
  onPress?: () => void;
  right?: React.ReactNode;
};

const TONES: Record<NonNullable<Badge['tone']>, { bg: string; fg: string }> = {
  indigo: { bg: 'rgba(99,102,241,0.12)', fg: '#4f46e5' },
  emerald: { bg: 'rgba(16,185,129,0.14)', fg: '#047857' },
  amber: { bg: 'rgba(245,158,11,0.15)', fg: '#b45309' },
  rose: { bg: 'rgba(244,63,94,0.14)', fg: '#be123c' },
  slate: { bg: 'rgba(15,23,42,0.08)', fg: '#334155' },
  sky: { bg: 'rgba(14,165,233,0.14)', fg: '#0369a1' },
};

/**
 * Unified list-item card used across Workers / Employers / Incidents / etc.
 */
export function ListItemCard({ title, subtitle, meta, icon, iconGradient = ['#6366f1', '#8b5cf6'] as const, badge, onPress, right }: Props) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const tone = badge?.tone ? TONES[badge.tone] : TONES.indigo;
  return (
    <Wrapper activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <LinearGradient colors={iconGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <FontAwesome name={icon ?? 'circle'} size={16} color="white" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.badgeText, { color: tone.fg }]}>{badge.label}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right ?? (onPress ? <FontAwesome name="chevron-right" size={12} color="rgba(15,23,42,0.35)" /> : null)}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.08)',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a', flexShrink: 1 },
  sub: { marginTop: 2, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  meta: { marginTop: 2, fontSize: 11, color: 'rgba(15,23,42,0.45)' },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
});
