import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  gradient?: readonly [string, string, ...string[]];
  onPress?: () => void;
};

/**
 * Big tappable action tile (used on role landing screens).
 * White card + colored gradient icon chip + chevron.
 */
export function ActionTile({ title, description, icon, gradient = ['#6366f1', '#8b5cf6'] as const, onPress }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.wrap}>
      <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <FontAwesome name={icon ?? 'circle'} size={18} color="white" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      <View style={styles.chevWrap}>
        <FontAwesome name="chevron-right" size={12} color="rgba(15,23,42,0.35)" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
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
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  desc: { marginTop: 3, fontSize: 12, color: 'rgba(15,23,42,0.55)' },
  chevWrap: { width: 22, alignItems: 'center' },
});
