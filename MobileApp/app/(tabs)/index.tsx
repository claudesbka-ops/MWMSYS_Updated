import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

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
  worker: '👷 Worker Dashboard',
  employer: '🏢 Employer Dashboard',
  agency: '💼 Agency Dashboard',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '🌙 Good night';
  if (h < 12) return '☀️ Good morning';
  if (h < 17) return '🌤️ Good afternoon';
  if (h < 21) return '🌆 Good evening';
  return '🌙 Good night';
}

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
      ? `${greeting()}, ${userName} • Plan: ${plan}`
      : `${greeting()}, ${userName} — stay safe today 💪`;

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

          {appRole === 'worker' && (
            <WorkerPanicHero onPress={() => router.push('/(tabs)/panic' as any)} />
          )}


          <SectionTitle title="✨ At a glance" />

          {loading && Object.keys(cards).length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : (
            <View style={styles.kpiWrap}>
              {appRole === 'worker' && (
                <>
                  <StatCard label="⚠️ Open Incidents" value={cards.openIncidents ?? 0} icon="warning" accent="rose" onPress={() => router.push('/(tabs)/incidents' as any)} />
                  <StatCard label="🌴 Pending Leave" value={cards.pendingLeaves ?? 0} icon="calendar" accent="amber" onPress={() => router.push('/(tabs)/leave' as any)} />
                  <StatCard label="⏰ Attendance" value={cards.openAttendance ?? 0} icon="clock-o" accent="emerald" onPress={() => router.push('/(tabs)/attendance' as any)} />
                </>
              )}
              {(appRole === 'employer' || appRole === 'agency') && (
                <>
                  <StatCard label="👥 Workers" value={cards.totalWorkers ?? 0} icon="users" accent="indigo" onPress={() => router.push('/(tabs)/workers' as any)} />
                  <StatCard label="⚠️ Incidents" value={cards.openIncidents ?? 0} icon="warning" accent="rose" onPress={() => router.push('/(tabs)/incidents' as any)} />
                  <StatCard label="🌴 Pending Leave" value={cards.pendingLeaves ?? 0} icon="calendar" accent="amber" onPress={() => router.push('/(tabs)/leave' as any)} />
                </>
              )}
            </View>
          )}

          <SectionTitle title="⚡ Quick actions" />

          <View style={styles.actions}>
            {appRole === 'worker' && (
              <>
                <ActionTile title="⏰ Attendance" description="Clock in/out and view records" icon="clock-o" gradient={['#10b981', '#22d3ee']} onPress={() => router.push('/(tabs)/attendance' as any)} />
                <ActionTile title="✅ Requests" description="Submit overtime and expense claims" icon="check-circle" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/requests' as any)} />
                <ActionTile title="🌴 Leave" description="Apply leave and track status" icon="calendar" gradient={['#f59e0b', '#fb923c']} onPress={() => router.push('/(tabs)/leave' as any)} />
                <ActionTile title="📄 Documents" description="Passport, permit and insurance uploads" icon="folder" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/documents' as any)} />
                <ActionTile title="⚖️ Disputes" description="Submit a salary dispute" icon="balance-scale" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/disputes' as any)} />
                <ActionTile title="📣 Broadcast" description="Read announcements" icon="bullhorn" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/broadcast' as any)} />
                <ActionTile title="🤖 Chat with MWMS AI" description="Ask questions about rights and process" icon="comments" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/(tabs)/chat' as any)} />
              </>
            )}
            {appRole === 'employer' && (
              <>
                <ActionTile title="👥 Workers" description="Your scoped workers list" icon="users" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/workers' as any)} />
                <ActionTile title="⏰ Attendance" description="Daily punch-in records" icon="clock-o" gradient={['#10b981', '#22d3ee']} onPress={() => router.push('/(tabs)/attendance' as any)} />
                <ActionTile title="✅ Requests" description="Approve overtime and expenses" icon="check-circle" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/requests' as any)} />
                <ActionTile title="🌴 Leave Requests" description="Approve or reject pending leave" icon="calendar" gradient={['#f59e0b', '#fb923c']} onPress={() => router.push('/(tabs)/leave' as any)} />
                <ActionTile title="🗓️ Roster" description="Shift templates and assignments" icon="calendar-o" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/roster' as any)} />
                <ActionTile title="📊 Timesheets" description="Planned vs actual hours" icon="table" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/timesheets' as any)} />
                <ActionTile title="💰 Payroll" description="Run and review payroll" icon="money" gradient={['#059669', '#10b981']} onPress={() => router.push('/(tabs)/payroll' as any)} />
                <ActionTile title="📋 Contracts" description="Employment contracts" icon="file-text" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/(tabs)/contracts' as any)} />
                <ActionTile title="⚖️ Disputes" description="Review salary disputes" icon="balance-scale" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/disputes' as any)} />
                <ActionTile title="🗺️ Live Map" description="Where your workers are right now" icon="map-marker" gradient={['#ec4899', '#8b5cf6']} onPress={() => router.push('/(tabs)/live-map' as any)} />
                <ActionTile title="⚠️ Incidents" description="Incident history & response" icon="warning" gradient={['#ef4444', '#f59e0b']} onPress={() => router.push('/(tabs)/incidents' as any)} />
                <ActionTile title="📣 Broadcast" description="Send announcements" icon="bullhorn" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/broadcast' as any)} />
                <ActionTile title="📈 Reports" description="Visa / insurance / entry / HRMS" icon="bar-chart" gradient={['#4f46e5', '#06b6d4']} onPress={() => router.push('/(tabs)/reports' as any)} />
                <ActionTile title="💎 Pricing" description="Manage subscription" icon="credit-card" gradient={['#a855f7', '#ec4899']} onPress={() => router.push('/(tabs)/pricing' as any)} />
              </>
            )}
            {appRole === 'agency' && (
              <>
                <ActionTile title="🏢 Employers" description="Employer directory you serve" icon="building" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/employers' as any)} />
                <ActionTile title="👥 Workers" description="All workers under your agency" icon="users" gradient={['#10b981', '#06b6d4']} onPress={() => router.push('/(tabs)/workers' as any)} />
                <ActionTile title="✅ Requests" description="Approve overtime and expenses" icon="check-circle" gradient={['#6366f1', '#8b5cf6']} onPress={() => router.push('/(tabs)/requests' as any)} />
                <ActionTile title="🗓️ Roster" description="Shift templates and assignments" icon="calendar-o" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/roster' as any)} />
                <ActionTile title="📊 Timesheets" description="Planned vs actual hours" icon="table" gradient={['#0ea5e9', '#6366f1']} onPress={() => router.push('/timesheets' as any)} />
                <ActionTile title="☑️ Attestation" description="Verify / reject attestation requests" icon="check-square" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/(tabs)/attestation' as any)} />
                <ActionTile title="⚠️ Incidents" description="Active incidents to triage" icon="warning" gradient={['#ef4444', '#f97316']} onPress={() => router.push('/(tabs)/incidents' as any)} />
                <ActionTile title="🔔 Live Alerts" description="Real-time panic feed" icon="bell" gradient={['#ef4444', '#a855f7']} onPress={() => router.push('/(tabs)/live-alerts' as any)} />
                <ActionTile title="🗺️ Live Map" description="Track worker locations" icon="map-marker" gradient={['#ec4899', '#8b5cf6']} onPress={() => router.push('/(tabs)/live-map' as any)} />
                <ActionTile title="⚖️ Disputes" description="Review salary disputes" icon="balance-scale" gradient={['#f59e0b', '#ef4444']} onPress={() => router.push('/disputes' as any)} />
                <ActionTile title="📣 Broadcast" description="Send announcements" icon="bullhorn" gradient={['#6366f1', '#ec4899']} onPress={() => router.push('/broadcast' as any)} />
                <ActionTile title="🔍 Search" description="Global lookup" icon="search" gradient={['#0ea5e9', '#10b981']} onPress={() => router.push('/(tabs)/search' as any)} />
                <ActionTile title="📈 Reports" description="Compliance, expiry and HRMS" icon="bar-chart" gradient={['#4f46e5', '#06b6d4']} onPress={() => router.push('/(tabs)/reports' as any)} />
                <ActionTile title="💎 Pricing" description="Manage subscription" icon="credit-card" gradient={['#a855f7', '#ec4899']} onPress={() => router.push('/(tabs)/pricing' as any)} />
              </>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ---------- Worker emergency hero ----------
function WorkerPanicHero({ onPress }: { onPress: () => void }) {
  const ring = useSharedValue(0);
  const press = useSharedValue(1);

  useEffect(() => {
    ring.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(ring);
  }, [ring]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring.value * 0.55 }],
    opacity: 0.55 * (1 - ring.value),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ((ring.value + 0.5) % 1) * 0.55 }],
    opacity: 0.4 * (1 - ((ring.value + 0.5) % 1)),
  }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <View style={panicStyles.wrap}>
      <View style={panicStyles.titleRow}>
        <FontAwesome name="exclamation-triangle" size={14} color="#b91c1c" />
        <Text style={panicStyles.titleText}>EMERGENCY · TAP TO SEND PANIC ALERT</Text>
      </View>

      <View style={panicStyles.center}>
        <Animated.View style={[panicStyles.ring, ringStyle]} />
        <Animated.View style={[panicStyles.ring, ring2Style]} />

        <Pressable
          onPress={onPress}
          onPressIn={() => {
            press.value = withTiming(0.94, { duration: 80 });
          }}
          onPressOut={() => {
            press.value = withTiming(1, { duration: 120 });
          }}
          accessibilityRole="button"
          accessibilityLabel="Send panic alert"
          testID="panic-btn"
          hitSlop={20}
        >
          <Animated.View style={buttonStyle}>
            <LinearGradient
              colors={['#ef4444', '#dc2626', '#b91c1c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={panicStyles.button}
            >
              <FontAwesome name="exclamation-triangle" size={48} color="#ffffff" />
              <Text style={panicStyles.buttonText}>PANIC</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>

      <Text style={panicStyles.helpText}>
        You can also describe the issue and attach a photo on the next screen.
      </Text>
    </View>
  );
}

const panicStyles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    marginBottom: 18,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(254,226,226,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  titleText: { fontSize: 11, fontWeight: '900', color: '#b91c1c', letterSpacing: 0.6 },
  center: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(239,68,68,0.45)',
  },
  button: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b91c1c',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  buttonText: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  helpText: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(15,23,42,0.6)',
    fontWeight: '600',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 40 },
  loadingWrap: { padding: 16, alignItems: 'flex-start' },
  kpiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { gap: 10 },
});
