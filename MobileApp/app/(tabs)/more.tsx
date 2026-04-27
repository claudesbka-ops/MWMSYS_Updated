import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useSession } from "@/contexts/SessionContext";
import { Screen, SectionTitle } from "@/components/ui";

type Tool = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  gradient: readonly [string, string];
  href: string;
  roles: string[];
};

// Mobile is scoped to worker / employer / agency. Tools are shown to whichever
// of those three roles can actually use them on the web.
const TOOLS: Tool[] = [
  { key: "account", title: "👤 Account", description: "Profile, avatar and subscription", icon: "user-circle", gradient: ["#4f46e5", "#a855f7"], href: "/account", roles: ["*"] },
  { key: "hrms", title: "💼 HRMS", description: "Attendance, requests, payroll, contracts", icon: "briefcase", gradient: ["#6366f1", "#06b6d4"], href: "/hrms", roles: ["worker", "employer", "agency"] },
  { key: "disputes", title: "⚖️ Salary disputes", description: "Submit and review disputes", icon: "balance-scale", gradient: ["#f59e0b", "#ef4444"], href: "/disputes", roles: ["worker", "employer", "agency"] },
  { key: "roster", title: "🗓️ Roster", description: "Shift templates and assignments", icon: "calendar-o", gradient: ["#6366f1", "#ec4899"], href: "/roster", roles: ["employer", "agency"] },
  { key: "timesheets", title: "📊 Timesheets", description: "Planned vs actual hours", icon: "table", gradient: ["#0ea5e9", "#6366f1"], href: "/timesheets", roles: ["employer", "agency"] },
  { key: "broadcast", title: "📣 Broadcast", description: "Live announcements feed", icon: "bullhorn", gradient: ["#6366f1", "#ec4899"], href: "/broadcast", roles: ["*"] },
  { key: "leave", title: "🌴 Leave", description: "Apply and approve leave", icon: "calendar", gradient: ["#6366f1", "#8b5cf6"], href: "/(tabs)/leave", roles: ["worker", "employer", "agency"] },
  { key: "payroll", title: "💰 Payroll", description: "Upload vouchers and history", icon: "money", gradient: ["#059669", "#10b981"], href: "/(tabs)/payroll", roles: ["employer", "agency"] },
  { key: "contracts", title: "📝 Contracts", description: "Expiring contracts", icon: "file-text", gradient: ["#f59e0b", "#fb7185"], href: "/(tabs)/contracts", roles: ["employer", "agency"] },
  { key: "workers", title: "👥 Workers", description: "Manage worker records", icon: "users", gradient: ["#6366f1", "#0ea5e9"], href: "/(tabs)/workers", roles: ["employer", "agency"] },
  { key: "employers", title: "🏢 Employers", description: "Employer directory", icon: "building", gradient: ["#f97316", "#ef4444"], href: "/(tabs)/employers", roles: ["agency"] },
  { key: "documents", title: "📄 Documents", description: "Passport, permits, IDs", icon: "folder", gradient: ["#0ea5e9", "#6366f1"], href: "/(tabs)/documents", roles: ["worker"] },
  { key: "chat", title: "💬 Chat", description: "Message your employer", icon: "comments", gradient: ["#8b5cf6", "#ec4899"], href: "/(tabs)/chat", roles: ["worker"] },
  { key: "incidents", title: "⚠️ Incidents", description: "Review incident reports", icon: "warning", gradient: ["#ef4444", "#f97316"], href: "/(tabs)/incidents", roles: ["employer", "agency"] },
  { key: "live-alerts", title: "🔔 Live alerts", description: "Real-time panic feed", icon: "bell", gradient: ["#ef4444", "#a855f7"], href: "/(tabs)/live-alerts", roles: ["agency"] },
  { key: "live-map", title: "🗺️ Live map", description: "Real-time worker locations", icon: "map-marker", gradient: ["#ec4899", "#6366f1"], href: "/(tabs)/live-map", roles: ["employer", "agency"] },
  { key: "attestation", title: "☑️ Attestation", description: "Attest incident reports", icon: "check-square", gradient: ["#10b981", "#0ea5e9"], href: "/(tabs)/attestation", roles: ["agency"] },
  { key: "reports", title: "📈 Reports", description: "Entry, visa and insurance expiry", icon: "bar-chart", gradient: ["#6366f1", "#0ea5e9"], href: "/(tabs)/reports", roles: ["employer", "agency"] },
  { key: "hrms-report", title: "📊 HRMS Report", description: "Consolidated attendance, overtime, expenses", icon: "table", gradient: ["#4f46e5", "#06b6d4"], href: "/(tabs)/hrms-report", roles: ["employer", "agency"] },
  { key: "search", title: "🔍 Search", description: "Global lookup", icon: "search", gradient: ["#0ea5e9", "#10b981"], href: "/(tabs)/search", roles: ["agency"] },
  { key: "pricing", title: "💎 Pricing", description: "Manage subscription", icon: "credit-card", gradient: ["#a855f7", "#ec4899"], href: "/(tabs)/pricing", roles: ["employer", "agency"] },
  { key: "settings", title: "⚙️ Settings", description: "Preferences and location", icon: "cog", gradient: ["#64748b", "#0f172a"], href: "/(tabs)/settings", roles: ["*"] },
];

export default function MoreScreen() {
  const router = useRouter();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();

  const visible = useMemo(() => TOOLS.filter((t) => t.roles.includes("*") || t.roles.includes(appRole)), [appRole]);

  return (
    <Screen title="✨ More" subtitle="Everything else available to your role" gradient={["#6366f1", "#8b5cf6", "#ec4899"]}>
      <SectionTitle title={`🔧 ${visible.length} tools`} />
      <View style={styles.grid}>
        {visible.map((t) => (
          <TouchableOpacity key={t.key} activeOpacity={0.88} onPress={() => router.push(t.href as any)} style={styles.card}>
            <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBadge}>
              <FontAwesome name={t.icon} size={16} color="white" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.sub}>{t.description}</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="rgba(15,23,42,0.3)" />
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(79,70,229,0.1)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  iconBadge: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  sub: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.6)", fontWeight: "600" },
});
