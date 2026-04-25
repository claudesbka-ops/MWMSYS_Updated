import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { usePlanGate } from "@/hooks/usePlanGate";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle, ListItemCard } from "@/components/ui";

export default function PayrollScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? "").toString();
  const gate = usePlanGate();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const [workerId, setWorkerId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState("0");
  const [voucherUri, setVoucherUri] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/HRMS/Payroll");
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appRole === "worker") return;
    refresh().catch(() => undefined);
  }, []);

  const pickVoucher = async () => {
    if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
      Alert.alert("Subscription required", "Please purchase a plan to upload payroll.");
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["application/pdf", "image/*"],
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;
    setVoucherUri(asset.uri);
  };

  const upload = async () => {
    if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
      Alert.alert("Subscription required", "Please purchase a plan to upload payroll.");
      return;
    }
    if (!workerId.trim()) {
      Alert.alert("Missing", "WorkerId is required");
      return;
    }

    setBusy(true);
    try {
      let voucherUrl: string | undefined = undefined;

      // If you want true file storage for payroll vouchers, add a dedicated backend upload endpoint.
      // For now we reuse the existing payroll API which accepts voucherUrl.
      if (voucherUri) {
        voucherUrl = voucherUri;
      }

      await api.post("/Api/HRMS/Payroll/Upload", {
        workerId: workerId.trim(),
        month: Number(month) || 0,
        year: Number(year) || 0,
        amount: Number(amount) || 0,
        voucherUrl,
        isPaid: true,
      });

      await refresh();
      Alert.alert("Uploaded", "Payroll uploaded");
      setWorkerId("");
      setAmount("0");
      setVoucherUri("");
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  if (appRole === "worker") {
    return (
      <Screen title="Payroll" subtitle="Not available for workers" gradient={["#059669", "#10b981"]}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Payroll is accessed by employers and agencies only.</Text>
        </View>
      </Screen>
    );
  }

  const isPaywalled = (appRole === "employer" || appRole === "agency") && !gate.hasPlan;

  return (
    <Screen
      title="Payroll"
      subtitle="Upload vouchers and view payroll history"
      gradient={["#059669", "#10b981", "#06b6d4"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {isPaywalled ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.25)' } as any}>
          <Text style={styles.paywallTitle}>Subscription required</Text>
          <Text style={styles.paywallSub}>Upgrade to upload payroll vouchers.</Text>
          <PrimaryButton title="View pricing" variant="danger" style={{ marginTop: 12 }} onPress={() => router.push("/(tabs)/pricing" as any)} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Worker ID</Text>
        <TextInput value={workerId} onChangeText={setWorkerId} style={styles.input} autoCapitalize="none" placeholder="W-001" placeholderTextColor="rgba(15,23,42,0.4)" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Month</Text>
            <TextInput value={month} onChangeText={setMonth} style={styles.input} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Year</Text>
            <TextInput value={year} onChangeText={setYear} style={styles.input} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="numeric" />

        <View style={styles.actionRow}>
          <GhostButton title={voucherUri ? "Change voucher" : "Pick voucher"} onPress={pickVoucher} disabled={busy || isPaywalled} />
          <PrimaryButton title={busy ? "Working…" : "Upload"} variant="success" loading={busy} onPress={upload} disabled={isPaywalled} style={{ flex: 1 }} />
        </View>
      </Card>

      <SectionTitle title={`History (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No payroll rows yet.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => (
            <ListItemCard
              key={String(item?.id ?? idx)}
              title={String(item?.workerId ?? "Worker")}
              subtitle={`Period: ${String(item?.month ?? "").padStart(2, "0")}/${String(item?.year ?? "")}`}
              meta={`Amount: ${String(item?.amount ?? "0")}`}
              icon="money"
              iconGradient={['#059669', '#10b981']}
              badge={item?.isPaid ? { label: "Paid", tone: "emerald" } : { label: "Pending", tone: "amber" }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paywallTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  paywallSub: { marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  label: { marginTop: 12, fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14, marginTop: 8, backgroundColor: '#ffffff', color: '#0f172a',
  },
  row: { flexDirection: 'row', gap: 10 },
  actionRow: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
});
