import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  title: string;
  subtitle?: string;
  gradient?: readonly [string, string, ...string[]];
  right?: React.ReactNode;
};

/**
 * Hero-style gradient header banner used at the top of dashboard / role
 * landing screens.
 */
export function ScreenHeader({ title, subtitle, gradient = ['#6366f1', '#8b5cf6', '#ec4899'] as const, right }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inner}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </LinearGradient>
    </View>
  );
}

type SectionTitleProps = {
  title: string;
  action?: React.ReactNode;
};

export function SectionTitle({ title, action }: SectionTitleProps) {
  return (
    <View style={stitle.row}>
      <Text style={stitle.txt}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  inner: { paddingVertical: 22, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { marginTop: 6, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },
});

const stitle = StyleSheet.create({
  row: {
    marginTop: 18,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txt: { fontSize: 14, fontWeight: '800', color: '#0f172a', letterSpacing: 0.3, textTransform: 'uppercase' },
});
