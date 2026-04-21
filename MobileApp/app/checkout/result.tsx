import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useSubscriptionService } from "@/services/subscriptionService";
import Colors from "@/constants/Colors";

export default function CheckoutResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const sub = useSubscriptionService();

  const status = useMemo(() => (params.status ?? "").toString().toLowerCase(), [params.status]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await sub.me();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to refresh subscription");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{status === "success" ? "Payment Successful" : "Payment Cancelled"}</Text>
      <Text style={styles.subtitle}>
        {status === "success"
          ? "Your plan will be activated shortly. If it doesn't unlock immediately, tap Refresh."
          : "No charges were made. You can try again anytime."}
      </Text>

      <View style={styles.card}>
        <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={refresh} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Refresh</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabled]} onPress={() => router.replace("/(tabs)/pricing" as any)} disabled={busy}>
          <Text style={styles.ghostText}>Back to Pricing</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 8, opacity: 0.7 },
  card: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border },
  primaryBtn: { paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: Colors.light.tint },
  primaryText: { color: "#fff", fontWeight: "900" },
  ghostBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 14, alignItems: "center" },
  ghostText: { fontWeight: "800", opacity: 0.8 },
  disabled: { opacity: 0.6 },
});
