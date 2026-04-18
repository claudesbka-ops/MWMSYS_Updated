import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

import { Text, View } from "@/components/Themed";
import { useApiClient } from "@/services/apiClient";

export default function NewIncidentScreen() {
  const router = useRouter();
  const api = useApiClient();

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
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>New Incident</Text>
      <Text style={styles.subtitle}>Create an issue record</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Search Worker</Text>
        <TextInput value={q} onChangeText={setQ} style={styles.input} placeholder="Search by worker/passport/company" />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={filtered.slice(0, 12)}
            keyExtractor={(item, idx) => String(item?.Worker_Id ?? idx)}
            style={{ maxHeight: 220, marginTop: 10 }}
            renderItem={({ item }) => {
              const id = String(item?.Worker_Id ?? "");
              const selected = id === workerId;
              return (
                <TouchableOpacity
                  style={[styles.workerRow, selected && styles.workerRowSelected]}
                  onPress={() => setWorkerId(id)}
                >
                  <Text style={styles.workerTitle}>{id}</Text>
                  <Text style={styles.workerSub}>Passport: {String(item?.Passport_Number ?? "—")}</Text>
                  <Text style={styles.workerSub}>Company: {String(item?.Company_Name ?? "—")}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <Text style={[styles.label, { marginTop: 12 }]}>Type</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.pill, type === "Issue" && styles.pillActive]} onPress={() => setType("Issue")}> 
            <Text style={styles.pillText}>Issue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, type === "Panic" && styles.pillActive]} onPress={() => setType("Panic")}> 
            <Text style={styles.pillText}>Panic</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Short title" />

        <Text style={[styles.label, { marginTop: 12 }]}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} multiline placeholder="Describe incident" />

        <TouchableOpacity style={[styles.primaryBtn, (busy || loading) && styles.disabled]} onPress={create} disabled={busy || loading}>
          <Text style={styles.primaryBtnText}>{busy ? "Creating..." : "Create Incident"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  backBtn: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  backText: { fontWeight: "800", opacity: 0.8 },
  title: { marginTop: 12, fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 6, fontSize: 14, opacity: 0.7 },
  card: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.8 },
  input: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)", paddingHorizontal: 12, marginTop: 8, color: "inherit" as any },
  multiline: { height: 110, paddingTop: 10 },
  loadingWrap: { padding: 12 },
  workerRow: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.18)" },
  workerRowSelected: { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "rgba(37,99,235,0.35)" },
  workerTitle: { fontWeight: "800" },
  workerSub: { marginTop: 2, fontSize: 11, opacity: 0.7 },
  row: { marginTop: 8, flexDirection: "row", gap: 10 },
  pill: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(120,120,120,0.25)" },
  pillActive: { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "rgba(37,99,235,0.35)" },
  pillText: { fontWeight: "800", opacity: 0.8 },
  primaryBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: "#2563eb", alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
