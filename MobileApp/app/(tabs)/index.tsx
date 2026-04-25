import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/contexts/SessionContext';
import { useDashboardService } from '@/services/dashboardService';
import { useApiClient } from '@/services/apiClient';
import { GradientBackground, ScreenHeader, StatCard, ActionTile, SectionTitle } from '@/components/ui';

type Role = 'worker' | 'employer' | 'agency';

const ROLE_GRADIENTS: Record<string, readonly [string, string, ...string[]]> = {
  worker: ['#10b981', '#06b6d4', '#6366f1'],
  employer: ['#6366f1', '#8b5cf6', '#ec4899'],
  agency: ['#f59e0b', '#ef4444', '#ec4899'],
};

const ROLE_TITLE: Record<string, string> = {
  worker: 'Worker Dashboard',
  employer: 'Employer Dashboard',
  agency: 'Agency Dashboard',
};

export default function HomeScreen() {
  const router = useRouter();
  const session = useSession();
  const appRole = ((session.claims?.appRole ?? session.claims?.role ?? 'worker').toString()) as Role;
  const userName = (session.claims?.userName ?? session.claims?.emailId ?? 'there').toString();
  const dashboard = useDashboardService();
  const api = useApiClient();

  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<string>('Free');

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await dashboard.getMe();
      setCards((res?.cards ?? {}) as any);

      if (appRole === 'employer' || appRole === 'agency') {
        try {
          const sub = await api.get<any>('/Api/subscription/me');
          setPlan((sub?.planType ?? 'Free').toString());
        } catch {
          setPlan('Free');
        }
      } else {
        setPlan('Free');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const headerSubtitle =
    appRole === 'employer' || appRole === 'agency'
      ? `Hi ${userName} • Plan: ${plan}`
      : `Hi ${userName} • Welcome back`;

  return (
    <GradientBackground colors={['#eef2ff', '#f5f3ff', '#fdf2f8']}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366f1" />}
        >
          <ScreenHeader
            title={ROLE_TITLE[appRole] ?? 'Dashboard'}
            subtitle={headerSubtitle}
            gradient={ROLE_GRADIENTS[appRole] ?? ROLE_GRADIENTS.worker}
          />

          <SectionTitle title="At a glance" />

          {loading && Object.keys(cards).length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : (
            <View style={styles.kpiWrap}>
              {appRole === 'worker' && (
                <>
                  <StatCard label="Open Incidents" value={cards.openIncidents ?? 0} icon="warning" accent="rose" onPress={() => router.push('/(tabs)/incidents' as any)} />
                  <StatCard label="Pending Leave" value={cards.pendingLeaves ?? 0} icon="calendar" accent="amber" onPress={() => router.push('/(tabs)/leave' as any)} />
                  <StatCard label="Attendance" value={cards.openAttendance ?? 0} icon="clock-o" accent="emerald" onPress={() => router.push('/(tabs)/attendance' as any)} />
                </>
              )}
              {(appRole === 'employer' || appRole === 'agency') && (
                <>
                  <StatCard label="Workers" value={cards.totalWorkers ?? 0} icon="users" accent="indigo" onPress={() => router.push('/(tabs)/workers' as any)} />
                  <StatCard label="Incidents" value={cards.openIncidents ?? 0} icon="warning" accent="rose" onPress={() => router.push('/(tabs)/incidents' as any)} />
                  <StatCard label="Pending Leave" value={cards.pendingLeaves ?? 0} icon="calendar" accent="amber" onPress={() => router.push('/(tabs)/leave' as any)} />
                </>
              )}
            </View>
          )}

          <SectionTitle title="Quick actions" />

          <View style={styles.actions}>
            {appRole === 'worker' && (
              <>
                <ActionTile title="Attendance" description="Clock in/out and view records" icon="clock-o" gradient={['#10b981', '#22d3ee']} onPress={() => router.push('/(tabs)/attendance' as any)} />
                <ActionTile title="Requests" description="Submit overtime and expense claims" icon="check-circle" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/requests' as any)} />
                <ActionTile title="Leave" description="Apply leave and track status" icon="calendar" gradient={['#f59e0b', '#fb923c']} onPress={() => router.push('/(tabs)/leave' as any)} />
                <ActionTile title="Documents" description="Passport, permit and insurance uploads" icon="folder" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/documents' as any)} />
                <ActionTile title="Disputes" description="Submit a salary dispute" icon="balance-scale" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/disputes' as any)} />
                <ActionTile title="Broadcast" description="Read announcements" icon="bullhorn" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/broadcast' as any)} />
                <ActionTile title="Chat with MWMS AI" description="Ask questions about rights and process" icon="comments" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/(tabs)/chat' as any)} />
                <ActionTile title="Panic" description="Send emergency alert instantly" icon="exclamation-triangle" gradient={['#ef4444', '#f97316']} onPress={() => router.push('/(tabs)/panic' as any)} />
              </>
            )}
            {appRole === 'employer' && (
              <>
                <ActionTile title="Workers" description="Your scoped workers list" icon="users" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/workers' as any)} />
                <ActionTile title="Attendance" description="Daily punch-in records" icon="clock-o" gradient={['#10b981', '#22d3ee']} onPress={() => router.push('/(tabs)/attendance' as any)} />
                <ActionTile title="Requests" description="Approve overtime and expenses" icon="check-circle" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/requests' as any)} />
                <ActionTile title="Leave Requests" description="Approve or reject pending leave" icon="calendar" gradient={['#f59e0b', '#fb923c']} onPress={() => router.push('/(tabs)/leave' as any)} />
                <ActionTile title="Roster" description="Shift templates and assignments" icon="calendar-o" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/roster' as any)} />
                <ActionTile title="Timesheets" description="Planned vs actual hours" icon="table" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/timesheets' as any)} />
                <ActionTile title="Payroll" description="Run and review payroll" icon="money" gradient={['#059669', '#10b981']} onPress={() => router.push('/(tabs)/payroll' as any)} />
                <ActionTile title="Contracts" description="Employment contracts" icon="file-text" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/(tabs)/contracts' as any)} />
                <ActionTile title="Disputes" description="Review salary disputes" icon="balance-scale" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/disputes' as any)} />
                <ActionTile title="Live Map" description="Where your workers are right now" icon="map-marker" gradient={['#ec4899', '#8b5cf6']} onPress={() => router.push('/(tabs)/live-map' as any)} />
                <ActionTile title="Incidents" description="Incident history & response" icon="warning" gradient={['#ef4444', '#f59e0b']} onPress={() => router.push('/(tabs)/incidents' as any)} />
                <ActionTile title="Broadcast" description="Send announcements" icon="bullhorn" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/broadcast' as any)} />
                <ActionTile title="Reports" description="Visa / insurance / entry / HRMS" icon="bar-chart" gradient={['#4f46e5', '#06b6d4']} onPress={() => router.push('/(tabs)/reports' as any)} />
                <ActionTile title="Pricing" description="Manage subscription" icon="credit-card" gradient={['#a855f7', '#ec4899']} onPress={() => router.push('/(tabs)/pricing' as any)} />
              </>
            )}
            {appRole === 'agency' && (
              <>
                <ActionTile title="Employers" description="Employer directory you serve" icon="building" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/employers' as any)} />
                <ActionTile title="Workers" description="All workers under your agency" icon="users" gradient={['#10b981', '#06b6d4']} onPress={() => router.push('/(tabs)/workers' as any)} />
                <ActionTile title="Requests" description="Approve overtime and expenses" icon="check-circle" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/requests' as any)} />
                <ActionTile title="Roster" description="Shift templates and assignments" icon="calendar-o" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/roster' as any)} />
                <ActionTile title="Timesheets" description="Planned vs actual hours" icon="table" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/timesheets' as any)} />
                <ActionTile title="Attestation" description="Verify / reject attestation requests" icon="check-square" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/(tabs)/attestation' as any)} />
                <ActionTile title="Incidents" description="Active incidents to triage" icon="warning" gradient={['#ef4444', '#f97316']} onPress={() => router.push('/(tabs)/incidents' as any)} />
                <ActionTile title="Live Alerts" description="Real-time panic feed" icon="bell" gradient={['#ef4444', '#a855f7']} onPress={() => router.push('/(tabs)/live-alerts' as any)} />
                <ActionTile title="Live Map" description="Track worker locations" icon="map-marker" gradient={['#ec4899', '#8b5cf6']} onPress={() => router.push('/(tabs)/live-map' as any)} />
                <ActionTile title="Disputes" description="Review salary disputes" icon="balance-scale" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/disputes' as any)} />
                <ActionTile title="Broadcast" description="Send announcements" icon="bullhorn" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/broadcast' as any)} />
                <ActionTile title="Search" description="Global lookup" icon="search" gradient={['#0ea5e9', '#10b981']} onPress={() => router.push('/(tabs)/search' as any)} />
                <ActionTile title="Reports" description="Compliance, expiry and HRMS" icon="bar-chart" gradient={['#4f46e5', '#06b6d4']} onPress={() => router.push('/(tabs)/reports' as any)} />
                <ActionTile title="Pricing" description="Manage subscription" icon="credit-card" gradient={['#a855f7', '#ec4899']} onPress={() => router.push('/(tabs)/pricing' as any)} />
              </>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 40 },
  loadingWrap: { padding: 16, alignItems: 'flex-start' },
  kpiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { gap: 10 },
});
