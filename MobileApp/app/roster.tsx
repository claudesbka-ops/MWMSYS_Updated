import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, PrimaryButton, Screen, SectionTitle } from "@/components/ui";

type ShiftTemplate = {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
};

type RosterRow = {
  id: number;
  workerId: string;
  date: string;
  shiftId: number;
  shiftName: string;
  shiftHours: number;
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function defaultRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function RosterScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? "worker").toString();
  const canWrite = appRole === "employer" || appRole === "agency" || appRole === "admin";

  const [{ from, to }, setRange] = useState(defaultRange());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);

  // Shift template form
  const [tplName, setTplName] = useState("Day Shift");
  const [tplStart, setTplStart] = useState("09:00");
  const [tplEnd, setTplEnd] = useState("18:00");
  const [tplBreak, setTplBreak] = useState("60");
  const [creatingTpl, setCreatingTpl] = useState(false);

  // Assignment form
  const [assignWorker, setAssignWorker] = useState("");
  const [assignDate, setAssignDate] = useState(isoDate(new Date()));
  const [assignShiftId, setAssignShiftId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  const loadRoster = useCallback(async () => {
    try {
      const url = `/Api/HRMS/Roster?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await api.get<{ rows: RosterRow[] }>(url);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load roster");
    }
  }, [api, from, to]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get<ShiftTemplate[]>("/Api/HRMS/Roster/Shifts");
      const list = Array.isArray(res) ? res : [];
      setTemplates(list);
      if (assignShiftId == null && list[0]) setAssignShiftId(list[0].id);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to load shift templates");
    }
  }, [api, assignShiftId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadRoster(), canWrite ? loadTemplates() : Promise.resolve()]);
    } finally {
      setLoading(false);
    }
  }, [loadRoster, loadTemplates, canWrite]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const grouped = useMemo(() => {
    const map = new Map<string, RosterRow[]>();
    rows.forEach((r) => {
      const key = String(r.date ?? "").slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const kpis = useMemo(() => {
    const assignments = rows.length;
    const uniqueWorkers = new Set(rows.map((r) => String(r.workerId ?? ""))).size;
    const totalHours = rows.reduce((acc, r) => acc + Number(r.shiftHours ?? 0), 0);
    return { assignments, uniqueWorkers, totalHours };
  }, [rows]);

  const createTemplate = async () => {
    const breakNum = Number(tplBreak);
    if (!tplName.trim() || !tplStart.trim() || !tplEnd.trim()) {
      return Alert.alert("Missing", "Name, start and end times are required");
    }
    setCreatingTpl(true);
    try {
      await api.post("/Api/HRMS/Roster/Shifts", {
        name: tplName.trim(),
        startTime: tplStart.trim(),
        endTime: tplEnd.trim(),
        breakMinutes: Number.isFinite(breakNum) ? breakNum : 0,
      });
      Alert.alert("Created", "Shift template added");
      await loadTemplates();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to create template");
    } finally {
      setCreatingTpl(false);
    }
  };

  const assign = async () => {
    if (!assignWorker.trim() || !assignDate.trim() || assignShiftId == null) {
      return Alert.alert("Missing", "Worker, date and shift are required");
    }
    setAssigning(true);
    try {
      await api.post("/Api/HRMS/Roster/Assign", {
        workerId: assignWorker.trim(),
        date: assignDate.trim(),
        shiftId: assignShiftId,
      });
      setAssignWorker("");
      Alert.alert("Saved", "Roster assignment updated");
      await loadRoster();
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Unable to assign");
    } finally {
      setAssigning(false);
    }
  };

  if (!canWrite && rows.length === 0 && !loading) {
    return (
      <Screen title="Roster" subtitle="Not available for this role" gradient={["#6366f1", "#8b5cf6"]}>
        <Card>
          <Text style={styles.muted}>Roster scheduling is visible to employers, agencies and admins.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Roster"
      subtitle="Shift scheduling and assignments"
      gradient={["#6366f1", "#8b5cf6", "#ec4899"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kpis.assignments}</Text>
          <Text style={styles.statLabel}>Assignments</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kpis.uniqueWorkers}</Text>
          <Text style={styles.statLabel}>Workers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kpis.totalHours.toFixed(1)}h</Text>
          <Text style={styles.statLabel}>Total hours</Text>
        </View>
      </View>

      <SectionTitle title="Date range" />
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>From</Text>
            <TextInput value={from} onChangeText={(v) => setRange((r) => ({ ...r, from: v }))} style={styles.input} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To</Text>
            <TextInput value={to} onChangeText={(v) => setRange((r) => ({ ...r, to: v }))} style={styles.input} autoCapitalize="none" />
          </View>
        </View>
      </Card>

      {canWrite ? (
        <>
          <SectionTitle title="Shift templates" />
          <Card>
            {templates.length === 0 ? (
              <Text style={styles.muted}>No templates yet. Create one below.</Text>
            ) : (
              <View style={styles.tplGrid}>
                {templates.map((t) => (
                  <View key={t.id} style={styles.tplPill}>
                    <FontAwesome name="clock-o" size={11} color="#4f46e5" />
                    <Text style={styles.tplPillText}>{t.name}</Text>
                    <Text style={styles.tplPillMeta}>{t.startTime}–{t.endTime}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.label, { marginTop: 16 }]}>New template</Text>
            <TextInput value={tplName} onChangeText={setTplName} placeholder="Name (e.g. Night Shift)" placeholderTextColor="rgba(15,23,42,0.4)" style={styles.input} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start (HH:mm)</Text>
                <TextInput value={tplStart} onChangeText={setTplStart} style={styles.input} autoCapitalize="none" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End (HH:mm)</Text>
                <TextInput value={tplEnd} onChangeText={setTplEnd} style={styles.input} autoCapitalize="none" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Break (min)</Text>
                <TextInput value={tplBreak} onChangeText={setTplBreak} keyboardType="numeric" style={styles.input} />
              </View>
            </View>
            <PrimaryButton title={creatingTpl ? "Creating…" : "Create template"} loading={creatingTpl} onPress={createTemplate} style={{ marginTop: 14 }} />
          </Card>

          <SectionTitle title="Assign shift" />
          <Card>
            <Text style={styles.label}>Worker ID</Text>
            <TextInput value={assignWorker} onChangeText={setAssignWorker} placeholder="W001" placeholderTextColor="rgba(15,23,42,0.4)" autoCapitalize="characters" style={styles.input} />
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput value={assignDate} onChangeText={setAssignDate} style={styles.input} autoCapitalize="none" />

            <Text style={styles.label}>Shift</Text>
            {templates.length === 0 ? (
              <Text style={styles.muted}>Create a shift template first.</Text>
            ) : (
              <View style={styles.shiftRow}>
                {templates.map((t) => {
                  const active = assignShiftId === t.id;
                  return (
                    <TouchableOpacity key={t.id} onPress={() => setAssignShiftId(t.id)} activeOpacity={0.85} style={[styles.shiftPill, active && styles.shiftPillActive]}>
                      <Text style={[styles.shiftPillText, active && { color: "white" }]}>{t.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <PrimaryButton title={assigning ? "Saving…" : "Assign shift"} loading={assigning} onPress={assign} style={{ marginTop: 14 }} />
          </Card>
        </>
      ) : null}

      <SectionTitle title={`${kpis.assignments} assignment${kpis.assignments === 1 ? "" : "s"}`} />
      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" />
      ) : grouped.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No roster assignments for this range.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {grouped.map(([date, list]) => (
            <View key={date}>
              <Text style={styles.dayHeader}>{date}</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {list.map((r) => (
                  <Card key={r.id} tight>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{r.workerId}</Text>
                        <Text style={styles.cardSub}>{r.shiftName}</Text>
                      </View>
                      <View style={styles.hoursPill}>
                        <Text style={styles.hoursPillText}>{Number(r.shiftHours ?? 0).toFixed(1)}h</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.back} onPress={() => router.back()}>Back</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: "rgba(15,23,42,0.65)", fontSize: 13, lineHeight: 19 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
    shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", color: "rgba(15,23,42,0.55)", letterSpacing: 0.3, textTransform: "uppercase" },

  label: { marginTop: 12, fontSize: 11, fontWeight: "800", color: "rgba(15,23,42,0.6)", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: "#ffffff", color: "#0f172a",
  },
  row: { flexDirection: "row", gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center" },

  tplGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tplPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.1)",
  },
  tplPillText: { fontSize: 11, fontWeight: "800", color: "#4f46e5" },
  tplPillMeta: { fontSize: 10, fontWeight: "700", color: "rgba(79,70,229,0.65)" },

  shiftRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shiftPill: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(99,102,241,0.2)",
  },
  shiftPillActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  shiftPillText: { fontSize: 12, fontWeight: "800", color: "rgba(15,23,42,0.65)" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },

  dayHeader: { fontSize: 12, fontWeight: "900", color: "rgba(15,23,42,0.55)", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 4 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  cardSub: { marginTop: 2, fontSize: 11, color: "rgba(15,23,42,0.6)", fontWeight: "600" },
  hoursPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(99,102,241,0.1)" },
  hoursPillText: { fontSize: 11, fontWeight: "900", color: "#4f46e5" },

  back: { marginTop: 18, textAlign: "center", color: "rgba(15,23,42,0.55)", fontSize: 13, fontWeight: "700" },
});
