import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { useApiClient } from "@/services/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { usePlanGate } from "@/hooks/usePlanGate";
import { Screen, ListItemCard, PrimaryButton, SectionTitle, Card } from "@/components/ui";

export default function IncidentsScreen() {
  const router = useRouter();
  const session = useSession();
  const api = useApiClient();
  const gate = usePlanGate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const appRole = (session.claims?.appRole ?? "").toString();
  const canCreate = appRole === "admin" || appRole === "agency" || appRole === "employer" || appRole === "embassy_source" || appRole === "embassy_destination" || appRole === "labour";
  const isEmployerOrAgency = appRole === "employer" || appRole === "agency";
  const canCreateNow = canCreate && (!isEmployerOrAgency || gate.hasPlan);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<any[]>("/Api/Incidents");
      setRows(Array.isArray(res) ? res : []);
    } catch (e: any) {
      Alert.alert("Error", e?.error ?? "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refresh().catch(() => undefined);
      return () => undefined;
    }, [])
  );

  const getBadgeTone = (status: string): 'emerald' | 'amber' | 'rose' | 'indigo' => {
    const s = status.toLowerCase();
    if (s.includes('resolved') || s.includes('closed')) return 'emerald';
    if (s.includes('progress') || s.includes('review')) return 'amber';
    if (s.includes('open') || s.includes('new')) return 'rose';
    return 'indigo';
  };

  return (
    <Screen
      title="Incidents"
      subtitle={`Scoped history • ${rows.length} total`}
      gradient={["#ef4444", "#f59e0b", "#ec4899"]}
      refreshing={loading}
      onRefresh={refresh}
    >
      {!gate.hasPlan && isEmployerOrAgency ? (
        <Card style={{ borderColor: 'rgba(239,68,68,0.25)' } as any}>
          <Text style={styles.paywallTitle}>Subscription required</Text>
          <Text style={styles.paywallSub}>Upgrade to create incidents and complaints.</Text>
          <PrimaryButton title="View pricing" variant="danger" style={{ marginTop: 12 }} onPress={() => router.push("/(tabs)/pricing" as any)} />
        </Card>
      ) : null}

      {canCreate ? (
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            title="+ Report new incident"
            variant="danger"
            onPress={() => {
              if (!canCreateNow) {
                Alert.alert("Subscription required", "Please purchase a plan to create incidents.");
                return;
              }
              router.push("/(tabs)/new-incident" as any);
            }}
          />
        </View>
      ) : null}

      <SectionTitle title={`All incidents (${rows.length})`} />

      {loading && rows.length === 0 ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No incidents reported.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((item, idx) => {
            const id = Number(item?.ID ?? 0);
            const status = String(item?.Status ?? item?.status ?? 'Open');
            return (
              <ListItemCard
                key={String(item?.ID ?? idx)}
                title={String(item?.Title ?? item?.Type ?? "Incident")}
                subtitle={`Worker: ${String(item?.worker_ID ?? "—")}`}
                meta={`Company: ${String(item?.Company_Name ?? "—")}`}
                icon="warning"
                iconGradient={["#ef4444", "#f97316"]}
                badge={{ label: status, tone: getBadgeTone(status) }}
                onPress={() => {
                  if (Number.isFinite(id) && id > 0) router.push(`/incident/${id}` as any);
                }}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paywallTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  paywallSub: { marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.6)' },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "rgba(15,23,42,0.55)", fontSize: 13 },
});
