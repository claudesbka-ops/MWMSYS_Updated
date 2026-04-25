import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'success';
  style?: ViewStyle | ViewStyle[];
};

const VARIANTS: Record<NonNullable<Props['variant']>, readonly [string, string]> = {
  primary: ['#6366f1', '#8b5cf6'],
  danger: ['#ef4444', '#f97316'],
  success: ['#10b981', '#22d3ee'],
};

export function PrimaryButton({ title, onPress, disabled, loading, variant = 'primary', style }: Props) {
  const isDisabled = disabled || loading;
  const colors = VARIANTS[variant];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.wrap, isDisabled && styles.disabled, style as any]}
    >
      <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inner}>
        <Text style={styles.text}>{loading ? 'Please wait…' : title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, disabled, style }: Omit<Props, 'variant' | 'loading'>) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={[styles.ghostWrap, disabled && styles.disabled, style as any]}
    >
      <Text style={styles.ghostText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: 'white', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  disabled: { opacity: 0.6 },
  ghostWrap: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
    backgroundColor: '#ffffff',
  },
  ghostText: { color: '#4f46e5', fontWeight: '700', fontSize: 14 },
});
