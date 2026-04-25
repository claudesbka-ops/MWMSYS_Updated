import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type OnboardingProgressProps = {
  step: number;
  total: number;
  label?: string;
};

export function OnboardingProgress({ step, total, label }: OnboardingProgressProps) {
  const pct = Math.max(0, Math.min(1, step / total));
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label ?? `Step ${step} of ${total}`}</Text>
      <View style={styles.track}>
        <LinearGradient
          colors={["#6366f1", "#8b5cf6", "#ec4899"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${pct * 100}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.55)", letterSpacing: 0.5, textTransform: "uppercase" },
  track: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.12)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 999 },
});

export default OnboardingProgress;
