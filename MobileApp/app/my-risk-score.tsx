import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { useApiClient } from "../services/apiClient";
import { useSession } from "../contexts/SessionContext";

type RiskData = {
  workerId: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  aiSummary?: string | null;
  factors?: string[];
  updatedAt?: string;
};

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const angle = (pct / 100) * 180 - 90;

  const getColor = (s: number) => {
    if (s < 30) return "#22c55e";
    if (s < 60) return "#f59e0b";
    if (s < 80) return "#f97316";
    return "#ef4444";
  };
  const color = getColor(pct);

  return (
    <View style={gaugeStyles.container}>
      <View style={gaugeStyles.arcWrapper}>
        <View style={[gaugeStyles.arc, { borderColor: "rgba(15,23,42,0.08)" }]} />
        <View
          style={[
            gaugeStyles.needle,
            {
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
        <View style={gaugeStyles.center} />
      </View>
      <Text style={[gaugeStyles.scoreText, { color }]}>{pct}</Text>
      <Text style={gaugeStyles.scoreLabel}>Risk Score</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 16 },
  arcWrapper: {
    width: 180,
    height: 90,
    position: "relative",
    alignItems: "center",
  },
  arc: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 14,
    position: "absolute",
    bottom: 0,
    overflow: "hidden",
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    borderLeftColor: "rgba(15,23,42,0.08)",
    borderBottomColor: "rgba(15,23,42,0.08)",
  },
  needle: {
    position: "absolute",
    bottom: 0,
    width: 3,
    height: 75,
    borderRadius: 2,
    transformOrigin: "bottom",
  },
  center: {
    position: "absolute",
    bottom: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#0f172a",
  },
  scoreText: { fontSize: 48, fontWeight: "900", marginTop: 10 },
  scoreLabel: { fontSize: 13, color: "rgba(15,23,42,0.5)", fontWeight: "600" },
});

function getLevelLabel(level: string): string {
  if (level === "low") return "Low Risk";
  if (level === "medium") return "Medium Risk";
  if (level === "high") return "High Risk";
  if (level === "critical") return "Critical Risk";
  return level;
}

function getLevelColor(level: string): string {
  if (level === "low") return "#22c55e";
  if (level === "medium") return "#f59e0b";
  if (level === "high") return "#f97316";
  return "#ef4444";
}

export default function MyRiskScoreScreen() {
  const router = useRouter();
  const api = useApiClient();
  const { claims } = useSession();
  const workerId = (claims as any)?.userKey ?? "";
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerId) {
      setError("Worker ID not found");
      setLoading(false);
      return;
    }
    api
      .get<{ success: boolean; data: RiskData }>(`/Api/Risk/Score/${workerId}`)
      .then((res) => setRiskData(res?.data ?? null))
      .catch(() => setError("Could not load risk score"))
      .finally(() => setLoading(false));
  }, [workerId]);

  const level = riskData?.level ?? "low";
  const levelColor = getLevelColor(level);
  const score = riskData?.score ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={16} color="#6366f1" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Risk Score</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <FontAwesome name="exclamation-circle" size={40} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Score Card */}
          <LinearGradient
            colors={["#ffffff", "#f0f9ff"]}
            style={styles.scoreCard}
          >
            <RiskGauge score={score} />
            <View style={[styles.levelBadge, { backgroundColor: levelColor + "1a" }]}>
              <Text style={[styles.levelText, { color: levelColor }]}>
                {getLevelLabel(level)}
              </Text>
            </View>
          </LinearGradient>

          {/* AI Summary */}
          {riskData?.aiSummary ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <FontAwesome name="magic" size={14} color="#6366f1" />
                <Text style={styles.summaryTitle}>AI Analysis</Text>
              </View>
              <Text style={styles.summaryText}>{riskData.aiSummary}</Text>
            </View>
          ) : null}

          {/* Risk Factors */}
          {riskData?.factors && riskData.factors.length > 0 ? (
            <View style={styles.factorsCard}>
              <Text style={styles.factorsTitle}>Risk Factors</Text>
              {riskData.factors.map((f, i) => (
                <View key={i} style={styles.factorRow}>
                  <View style={[styles.factorDot, { backgroundColor: levelColor }]} />
                  <Text style={styles.factorText}>{f}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Last Updated */}
          {riskData?.updatedAt ? (
            <Text style={styles.updatedText}>
              Last updated: {new Date(riskData.updatedAt).toLocaleDateString()}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.07)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 15, color: "#ef4444", fontWeight: "600", marginTop: 8 },
  content: { padding: 16, gap: 14 },
  scoreCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  levelBadge: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: { fontSize: 14, fontWeight: "800" },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  summaryTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  summaryText: { fontSize: 13, color: "rgba(15,23,42,0.7)", lineHeight: 20 },
  factorsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  factorsTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  factorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  factorDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  factorText: { fontSize: 13, color: "rgba(15,23,42,0.7)", flex: 1 },
  updatedText: {
    fontSize: 11,
    color: "rgba(15,23,42,0.4)",
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
});
