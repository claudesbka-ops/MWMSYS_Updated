import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useSession } from '@/contexts/SessionContext';
import { useEmergencyBadge } from '@/services/syncBus';

const ACTIVE_COLOR = '#4f46e5';
const INACTIVE_COLOR = 'rgba(15,23,42,0.45)';

function TabBarIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused: boolean;
}) {
  if (focused) {
    return (
      <View style={styles.iconWrap}>
        <LinearGradient
          colors={["#6366f1", "#8b5cf6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBg}
        />
        <FontAwesome name={name} size={18} color="#ffffff" />
      </View>
    );
  }
  return (
    <View style={styles.iconWrap}>
      <FontAwesome name={name} size={20} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? 'worker').toString();

  const { count: emergencyCount } = useEmergencyBadge();

  // Mobile is restricted to worker / employer / agency.
  const isWorker = appRole === 'worker';
  const isEmployer = appRole === 'employer';
  const isAgency = appRole === 'agency';
  const isManager = isEmployer || isAgency;
  // Keep the primary tab bar focused (5 items max per role). Everything
  // else is reachable via the More hub.
  const showAttendance = isWorker || isManager;
  const showRequests = isWorker || isManager;
  const showPanic = isWorker;
  const showIncidents = isManager;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: styles.bar,
        tabBarHideOnKeyboard: true,
        headerShown: useClientOnlyValue(false, true),
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: '#0f172a',
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '🏠 Home',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          href: showAttendance ? undefined : null,
          title: '⏰ Attendance',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="clock-o" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          href: showRequests ? undefined : null,
          title: '✅ Requests',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="check-circle" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="panic"
        options={{
          href: showPanic ? undefined : null,
          title: '🚨 Panic',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="exclamation-triangle" color={color} focused={focused} />,
          tabBarBadge: emergencyCount > 0 ? emergencyCount : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          href: showIncidents ? undefined : null,
          title: '⚠️ Incidents',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="warning" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: '✨ More',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="ellipsis-h" color={color} focused={focused} />,
        }}
      />

      {/* Routes hidden from the primary bar but still routable (accessed via More) */}
      <Tabs.Screen name="leave" options={{ href: null, title: 'Leave' }} />
      <Tabs.Screen name="payroll" options={{ href: null, title: 'Payroll' }} />
      <Tabs.Screen name="contracts" options={{ href: null, title: 'Contracts' }} />
      <Tabs.Screen name="documents" options={{ href: null, title: 'Docs' }} />
      <Tabs.Screen name="chat" options={{ href: null, title: 'Chat' }} />
      <Tabs.Screen name="workers" options={{ href: null, title: 'Workers' }} />
      <Tabs.Screen name="new-worker" options={{ href: null, title: 'New Worker' }} />
      <Tabs.Screen name="employers" options={{ href: null, title: 'Employers' }} />
      <Tabs.Screen name="search" options={{ href: null, title: 'Search' }} />
      <Tabs.Screen name="live-alerts" options={{ href: null, title: 'Alerts' }} />
      <Tabs.Screen name="live-map" options={{ href: null, title: 'Live map' }} />
      <Tabs.Screen name="new-incident" options={{ href: null, title: 'New Incident' }} />
      <Tabs.Screen name="attestation" options={{ href: null, title: 'Attest' }} />
      <Tabs.Screen name="reports" options={{ href: null, title: 'Reports' }} />
      <Tabs.Screen name="hrms-report" options={{ href: null, title: 'HRMS Report' }} />
      <Tabs.Screen name="pricing" options={{ href: null, title: 'Pricing' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: Platform.OS === 'ios' ? 82 : 64,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(79,70,229,0.08)',
    backgroundColor: '#ffffff',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  item: { paddingTop: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2, marginTop: 2 },
  iconWrap: {
    width: 36,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  badge: {
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    minWidth: 16,
    height: 16,
    lineHeight: 16,
    borderRadius: 8,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(79,70,229,0.06)',
  },
  headerTitle: { fontWeight: '800', color: '#0f172a', fontSize: 16, letterSpacing: 0.2 },
});
