import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";

export default function PayrollScreen() {
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? "").toString();

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
      <View style={styles.container}>
        <Text style={styles.title}>Payroll</Text>
        <Text style={styles.subtitle}>Not available for worker role</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payroll</Text>
      <Text style={styles.subtitle}>Uploads (paywalled for employer/agency)</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Worker ID</Text>
        <TextInput value={workerId} onChangeText={setWorkerId} style={styles.input} autoCapitalize="none" />

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

        <View style={styles.rowTight}>
          <TouchableOpacity style={[styles.ghostBtn, busy && styles.disabled]} onPress={pickVoucher} disabled={busy}>
            <Text style={styles.ghostText}>{voucherUri ? "Change Voucher" : "Pick Voucher"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, busy && styles.disabled]} onPress={upload} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "Working..." : "Upload"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => String(item?.id ?? idx)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.rowCard}>
              <Text style={styles.rowTitle}>{String(item?.workerId ?? "")}</Text>
              <Text style={styles.rowSub}>Period: {String(item?.month ?? "").padStart(2, "0")}/{String(item?.year ?? "")}</Text>
              <Text style={styles.rowSub}>Amount: {String(item?.amount ?? "0")}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No payroll rows</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { marginTop: 10, fontSize: 12, fontWeight: "700", opacity: 0.8 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, marginTop: 8, color: "inherit" as any },
  row: { flexDirection: "row", gap: 10 },
  rowTight: { marginTop: 12, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  ghostText: { fontWeight: "800", opacity: 0.8 },
  primaryBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#2563eb" },
  primaryText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
  loadingWrap: { padding: 18 },
  list: { paddingVertical: 14, gap: 10 },
  rowCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  rowTitle: { fontSize: 13, fontWeight: "800" },
  rowSub: { marginTop: 6, fontSize: 12, opacity: 0.75 },
  emptyWrap: { paddingVertical: 30, alignItems: "center" },
  emptyText: { opacity: 0.7 },
});
