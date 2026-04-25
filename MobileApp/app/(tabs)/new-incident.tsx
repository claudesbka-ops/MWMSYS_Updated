import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { usePlanGate } from "@/hooks/usePlanGate";
import { Screen, Card, PrimaryButton } from "@/components/ui";

export default function NewIncidentScreen() {
  const router = useRouter();
  const api = useApiClient();
  const session = useSession();
  const gate = usePlanGate();
  const appRole = (session.claims?.appRole ?? "").toString();
  const isEmployerOrAgency = appRole === "employer" || appRole === "agency";
  const locked = isEmployerOrAgency && !gate.hasPlan;

  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);

  const [q, setQ] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [type, setType] = useState<"Issue" | "Panic">("Issue");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshWorkers = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/Workers/List");
      setWorkers(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load workers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkers().catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return workers;
    return workers.filter((w) =>
      String(w?.Worker_Id ?? "").toLowerCase().includes(s) ||
      String(w?.Passport_Number ?? "").toLowerCase().includes(s) ||
      String(w?.Company_Name ?? "").toLowerCase().includes(s)
    );
  }, [q, workers]);

  const create = async () => {
    if (locked) {
      Alert.alert("Subscription required", "Please purchase a plan to create incidents/complaints.");
      return;
    }
    if (!workerId.trim()) {
      Alert.alert("Missing", "Select a worker");
      return;
    }
    if (!title.trim() && !description.trim()) {
      Alert.alert("Missing", "Title or description is required");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; id: number }>("/Api/Incidents", {
        workerId: workerId.trim(),
        type,
        title: title.trim() || type,
        description: description.trim(),
      });
      const id = Number((res as any)?.id ?? 0);
      if (!id) {
        Alert.alert("Created", "Incident created");
        router.back();
        return;
      }
      router.replace(`/incident/${id}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to create incident");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="New Incident" subtitle="Report an issue or panic event" gradient={["#ef4444", "#f59e0b", "#ec4899"]}>
      {locked ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.25)' } as any}>
          <Text style={styles.paywallTitle}>Subscription required</Text>
          <Text style={styles.paywallSub}>Upgrade to report incidents and complaints.</Text>
          <PrimaryButton title="View pricing" variant="danger" style={{ marginTop: 12 }} onPress={() => router.push("/(tabs)/pricing" as any)} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Search worker</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          style={[styles.input, locked && styles.disabledInput]}
          placeholder="Search by ID, passport, company"
          placeholderTextColor="rgba(15,23,42,0.4)"
          editable={!locked}
          autoCapitalize="none"
        />

        {loading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
        ) : (
          <View style={{ marginTop: 10, gap: 6, maxHeight: 260 }}>
            {filtered.slice(0, 8).map((item, idx) => {
              const id = String(item?.Worker_Id ?? "");
              const selected = id === workerId;
              return (
                <TouchableOpacity
                  key={id || idx}
                  style={[styles.workerRow, selected && styles.workerRowSelected]}
                  onPress={() => setWorkerId(id)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerTitle}>{id || "Worker"}</Text>
                    <Text style={styles.workerSub}>
                      {String(item?.Passport_Number ?? "—")} · {String(item?.Company_Name ?? "—")}
                    </Text>
                  </View>
                  {selected ? <Text style={styles.selectedCheck}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 ? <Text style={styles.muted}>No workers match your search.</Text> : null}
          </View>
        )}

        <Text style={styles.label}>Type</Text>
        <View style={styles.pillRow}>
          {(['Issue', 'Panic'] as const).map((t) => {
            const selected = type === t;
            return (
              <TouchableOpacity key={t} onPress={() => setType(t)} activeOpacity={0.85} style={[styles.pill, selected && styles.pillActive]}>
                {selected && (
                  <LinearGradient
                    colors={t === 'Panic' ? (["#ef4444", "#f97316"] as const) : (["#6366f1", "#8b5cf6"] as const)}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill as any}
                  />
                )}
                <Text style={[styles.pillText, selected && styles.pillTextActive]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[styles.input, locked && styles.disabledInput]}
          placeholder="Short title"
          placeholderTextColor="rgba(15,23,42,0.4)"
          editable={!locked}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.multiline, locked && styles.disabledInput]}
          multiline
          placeholder="Describe the incident"
          placeholderTextColor="rgba(15,23,42,0.4)"
          editable={!locked}
        />

        <PrimaryButton
          title={busy ? "Creating…" : "Create incident"}
          variant={type === 'Panic' ? 'danger' : 'primary'}
          loading={busy}
          disabled={loading || locked}
          onPress={create}
          style={{ marginTop: 18 }}
        />
      </Card>

      <Text style={styles.cancel} onPress={() => router.back()}>Cancel</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paywallTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  paywallSub: { marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  label: { marginTop: 14, fontSize: 11, fontWeight: '800', color: 'rgba(15,23,42,0.6)', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
    backgroundColor: '#ffffff', color: '#0f172a',
  },
  disabledInput: { opacity: 0.55 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  pillRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  pill: {
    overflow: 'hidden',
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(79,70,229,0.15)',
  },
  pillActive: { borderColor: 'transparent' },
  pillText: { fontSize: 12, fontWeight: '800', color: 'rgba(15,23,42,0.6)' },
  pillTextActive: { color: 'white' },
  workerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(79,70,229,0.1)',
    backgroundColor: '#ffffff',
  },
  workerRowSelected: { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.06)' },
  workerTitle: { fontWeight: '800', color: '#0f172a', fontSize: 13 },
  workerSub: { marginTop: 2, fontSize: 11, color: 'rgba(15,23,42,0.6)' },
  selectedCheck: { fontSize: 16, color: '#6366f1', fontWeight: '900' },
  muted: { color: 'rgba(15,23,42,0.5)', fontSize: 12 },
  cancel: {
    marginTop: 18, textAlign: 'center', color: 'rgba(15,23,42,0.55)',
    fontSize: 13, fontWeight: '700',
  },
});
