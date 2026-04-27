import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { usePlanGate } from "@/hooks/usePlanGate";
import { Screen, Card, PrimaryButton, GhostButton, SectionTitle, ListItemCard } from "@/components/ui";

type PayrollRow = {
  id?: number;
  workerId?: string;
  month?: number;
  year?: number;
  amount?: number;
  voucherUrl?: string | null;
  isPaid?: boolean;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(month?: number, year?: number) {
  const m = Number(month ?? 0);
  const y = Number(year ?? 0);
  const name = m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : String(month ?? "—");
  return `${name} ${y || "—"}`;
}

function formatRM(n?: number) {
  const v = Number(n ?? 0);
  return `RM ${Number.isFinite(v) ? v.toFixed(2) : "0.00"}`;
}

export default function PayrollScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? "").toString();
  const gate = usePlanGate();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PayrollRow[]>([]);

  const [workerId, setWorkerId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState("0");
  const [voucherUri, setVoucherUri] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const path = appRole === "worker" ? "/Api/HRMS/Payroll/Mine" : "/Api/HRMS/Payroll";
      const res = await api.get<PayrollRow[]>(path);
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [api, appRole]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const pickVoucher = async () => {
    if ((appRole === "employer" || appRole === "agency") && !gate.hasPlan) {
      Alert.alert("💎 Subscription required", "Please purchase a plan to upload payroll.");
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
      Alert.alert("💎 Subscription required", "Please purchase a plan to upload payroll.");
      return;
    }
    if (!workerId.trim()) {
      Alert.alert("⚠️ Missing", "WorkerId is required");
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
      Alert.alert("✅ Uploaded", "Payroll uploaded");
      setWorkerId("");
      setAmount("0");
      setVoucherUri("");
    } catch (e: any) {
      Alert.alert("⚠️ Error", e?.error ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const totalRM = rows.reduce((sum, r) => sum + Number(r?.amount ?? 0), 0);
    const paidRM = rows.filter((r) => r?.isPaid).reduce((sum, r) => sum + Number(r?.amount ?? 0), 0);
    return { totalRM, paidRM, count: rows.length };
  }, [rows]);

  const openVoucher = async (url?: string | null) => {
    if (!url) {
      Alert.alert("📄 Voucher", "No voucher attached for this payslip.");
      return;
    }
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error("open_failed");
      await Linking.openURL(url);
    } catch {
      Alert.alert("⚠️ Voucher", "Unable to open this link on your device.");
    }
  };

  if (appRole === "worker") {
    return (
      <Screen
        title="💰 My Payslips"
        subtitle={`${totals.count} ${totals.count === 1 ? "payslip" : "payslips"} · ${formatRM(totals.paidRM)} received`}
        gradient={["#059669", "#10b981", "#06b6d4"]}
        refreshing={loading}
        onRefresh={refresh}
      >
        <View style={styles.summaryRow}>
          <SummaryPill label="📜 Records" value={String(totals.count)} gradient={["#0ea5e9", "#6366f1"]} />
          <SummaryPill label="✅ Paid" value={formatRM(totals.paidRM)} gradient={["#10b981", "#06b6d4"]} />
          <SummaryPill label="💵 Total" value={formatRM(totals.totalRM)} gradient={["#f59e0b", "#fb7185"]} />
        </View>

        <SectionTitle title={`🗂️ Payslip history (${rows.length})`} />

        {loading && rows.length === 0 ? (
          <ActivityIndicator color="#10b981" />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome name="money" size={36} color="rgba(16,185,129,0.35)" />
            <Text style={styles.emptyText}>📜 No payslips yet — your employer will upload them here.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((r, idx) => (
              <PayslipCard key={String(r?.id ?? idx)} row={r} onOpen={() => openVoucher(r?.voucherUrl)} />
            ))}
          </View>
        )}
      </Screen>
    );
  }

  const isPaywalled = (appRole === "employer" || appRole === "agency") && !gate.hasPlan;

  return (
    <Screen
      title="💰 Payroll"
      subtitle="Upload vouchers and view payroll history"
      gradient={["#059669", "#10b981", "#06b6d4"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {isPaywalled ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.25)' } as any}>
          <Text style={styles.paywallTitle}>💎 Subscription required</Text>
          <Text style={styles.paywallSub}>Upgrade to upload payroll vouchers.</Text>
          <PrimaryButton title="🔓 View pricing" variant="danger" style={{ marginTop: 12 }} onPress={() => router.push("/(tabs)/pricing" as any)} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>👷 Worker ID</Text>
        <TextInput value={workerId} onChangeText={setWorkerId} style={styles.input} autoCapitalize="none" placeholder="W-001" placeholderTextColor="rgba(15,23,42,0.4)" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>🗓️ Month</Text>
            <TextInput value={month} onChangeText={setMonth} style={styles.input} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>📆 Year</Text>
            <TextInput value={year} onChangeText={setYear} style={styles.input} keyboardType="numeric" />
          </View>
        </View>

        <Text style={styles.label}>💵 Amount</Text>
        <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="numeric" />

        <View style={styles.actionRow}>
          <GhostButton title={voucherUri ? "🔄 Change voucher" : "📎 Pick voucher"} onPress={pickVoucher} disabled={busy || isPaywalled} />
          <PrimaryButton title={busy ? "⏳ Working…" : "⬆️ Upload"} variant="success" loading={busy} onPress={upload} disabled={isPaywalled} style={{ flex: 1 }} />
        </View>
      </Card>

      <SectionTitle title={`📜 History (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>📜 No payroll rows yet.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => (
            <ListItemCard
              key={String(item?.id ?? idx)}
              title={String(item?.workerId ?? "Worker")}
              subtitle={`Period: ${formatPeriod(item?.month, item?.year)}`}
              meta={`Amount: ${formatRM(item?.amount)}`}
              icon="money"
              iconGradient={['#059669', '#10b981']}
              badge={item?.isPaid ? { label: "✅ Paid", tone: "emerald" } : { label: "⏳ Pending", tone: "amber" }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function SummaryPill({ label, value, gradient }: { label: string; value: string; gradient: readonly [string, string] }) {
  return (
    <View style={styles.pill}>
      <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as any} />
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

function PayslipCard({ row, onOpen }: { row: PayrollRow; onOpen: () => void }) {
  const period = formatPeriod(row?.month, row?.year);
  const amount = formatRM(row?.amount);
  const paid = !!row?.isPaid;
  const hasVoucher = !!row?.voucherUrl;
  return (
    <Card tight>
      <View style={styles.payslipRow}>
        <LinearGradient colors={["#059669", "#10b981"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.payslipBadge}>
          <FontAwesome name="money" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.payslipTitle}>{period}</Text>
          <Text style={styles.payslipAmount}>{amount}</Text>
        </View>
        <View style={[styles.statusPill, paid ? styles.statusPillPaid : styles.statusPillPending]}>
          <Text style={[styles.statusPillText, paid ? styles.statusPillTextPaid : styles.statusPillTextPending]}>
            {paid ? "✅ Paid" : "⏳ Pending"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.85}
        disabled={!hasVoucher}
        style={[styles.voucherBtn, !hasVoucher && styles.voucherBtnDisabled]}
      >
        <FontAwesome name={hasVoucher ? "download" : "file-o"} size={13} color={hasVoucher ? "#4f46e5" : "rgba(15,23,42,0.4)"} />
        <Text style={[styles.voucherBtnText, !hasVoucher && styles.voucherBtnTextDisabled]}>
          {hasVoucher ? "📄 Open voucher" : "📄 No voucher attached"}
        </Text>
      </TouchableOpacity>
    </Card>
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
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: 'rgba(15,23,42,0.55)', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },

  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 12 },
  pill: {
    flex: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    minHeight: 70,
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pillLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.92)', letterSpacing: 0.6 },
  pillValue: { marginTop: 4, fontSize: 16, fontWeight: '900', color: '#fff' },

  payslipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payslipBadge: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  payslipTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  payslipAmount: { marginTop: 2, fontSize: 16, fontWeight: '900', color: '#0f172a' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  statusPillPaid: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.35)' },
  statusPillPending: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' },
  statusPillText: { fontSize: 11, fontWeight: '900' },
  statusPillTextPaid: { color: '#047857' },
  statusPillTextPending: { color: '#92400e' },

  voucherBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(79,70,229,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.18)',
  },
  voucherBtnDisabled: {
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderColor: 'rgba(15,23,42,0.08)',
  },
  voucherBtnText: { fontSize: 12, fontWeight: '800', color: '#4f46e5' },
  voucherBtnTextDisabled: { color: 'rgba(15,23,42,0.4)' },
});
