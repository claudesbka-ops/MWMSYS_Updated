import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { useSession } from '@/contexts/SessionContext';
import { useDashboardService } from '@/services/dashboardService';

export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? 'worker').toString();
  const dashboard = useDashboardService();

  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Record<string, number>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await dashboard.getMe();
      setCards((res?.cards ?? {}) as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MWMSYS HRMS</Text>
      <Text style={styles.subtitle}>{appRole} dashboard</Text>

      <View style={styles.kpiWrap}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            {appRole === 'worker' ? (
              <>
                <TouchableOpacity style={styles.kpiCard} onPress={() => router.push('/(tabs)/incidents' as any)}>
                  <Text style={styles.kpiLabel}>Open Incidents</Text>
                  <Text style={styles.kpiValue}>{String(cards.openIncidents ?? 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.kpiCard} onPress={() => router.push('/(tabs)/leave' as any)}>
                  <Text style={styles.kpiLabel}>Pending Leave</Text>
                  <Text style={styles.kpiValue}>{String(cards.pendingLeaves ?? 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.kpiCard} onPress={() => router.push('/(tabs)/attendance' as any)}>
                  <Text style={styles.kpiLabel}>Attendance Open</Text>
                  <Text style={styles.kpiValue}>{String(cards.openAttendance ?? 0)}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.kpiCard} onPress={() => router.push('/(tabs)/workers' as any)}>
                  <Text style={styles.kpiLabel}>Workers</Text>
                  <Text style={styles.kpiValue}>{String(cards.totalWorkers ?? 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.kpiCard} onPress={() => router.push('/(tabs)/incidents' as any)}>
                  <Text style={styles.kpiLabel}>Open Incidents</Text>
                  <Text style={styles.kpiValue}>{String(cards.openIncidents ?? 0)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.kpiCard} onPress={() => router.push('/(tabs)/leave' as any)}>
                  <Text style={styles.kpiLabel}>Pending Leave</Text>
                  <Text style={styles.kpiValue}>{String(cards.pendingLeaves ?? 0)}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>

      <View style={styles.cards}>
        {appRole === 'worker' ? (
          <>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/attendance' as any)}>
              <Text style={styles.cardTitle}>Attendance</Text>
              <Text style={styles.cardDesc}>Clock in/out and view records</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/leave' as any)}>
              <Text style={styles.cardTitle}>Leave</Text>
              <Text style={styles.cardDesc}>Apply leave and track status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/documents' as any)}>
              <Text style={styles.cardTitle}>Documents</Text>
              <Text style={styles.cardDesc}>Passport/permit/insurance uploads</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/panic' as any)}>
              <Text style={styles.cardTitle}>Panic</Text>
              <Text style={styles.cardDesc}>Send emergency alert to MWMSYS</Text>
            </TouchableOpacity>
          </>
        ) : appRole === 'employer' ? (
          <>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/workers' as any)}>
              <Text style={styles.cardTitle}>Workers</Text>
              <Text style={styles.cardDesc}>Your scoped workers list</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/incidents' as any)}>
              <Text style={styles.cardTitle}>Incidents</Text>
              <Text style={styles.cardDesc}>Incident history</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/pricing' as any)}>
              <Text style={styles.cardTitle}>Pricing</Text>
              <Text style={styles.cardDesc}>Manage subscription</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/employers' as any)}>
              <Text style={styles.cardTitle}>Employers</Text>
              <Text style={styles.cardDesc}>Employer directory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/workers' as any)}>
              <Text style={styles.cardTitle}>Workers</Text>
              <Text style={styles.cardDesc}>Workers directory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/attestation' as any)}>
              <Text style={styles.cardTitle}>Attestation</Text>
              <Text style={styles.cardDesc}>Approve/reject attestation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/reports' as any)}>
              <Text style={styles.cardTitle}>Reports</Text>
              <Text style={styles.cardDesc}>Entry/Visa/Insurance reports</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.7,
  },
  cards: {
    marginTop: 16,
    gap: 12,
  },
  kpiWrap: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.25)',
    minWidth: 110,
  },
  kpiLabel: { fontSize: 11, opacity: 0.7, fontWeight: '700' },
  kpiValue: { marginTop: 8, fontSize: 18, fontWeight: '800' },
  loadingWrap: { padding: 12 },
  refreshBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.25)',
  },
  refreshText: { fontWeight: '800', opacity: 0.8 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.25)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
  },
});
