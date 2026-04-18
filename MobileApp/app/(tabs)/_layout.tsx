import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useSession } from '@/contexts/SessionContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const session = useSession();
  const appRole = (session.claims?.appRole ?? session.claims?.role ?? 'worker').toString();

  const isWorker = appRole === 'worker';
  const isEmployer = appRole === 'employer';
  const isAgency = appRole === 'agency';
  const isAdmin = appRole === 'admin';
  const isAuthority = isAdmin || isAgency || appRole === 'embassy_source' || appRole === 'embassy_destination' || appRole === 'labour';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="info-circle"
                    size={25}
                    color={Colors[colorScheme ?? 'light'].text}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          href: isWorker || isEmployer || isAgency || isAdmin ? undefined : null,
          title: 'Attendance',
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          href: isWorker || isEmployer || isAgency || isAdmin ? undefined : null,
          title: 'Leave',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
        }}
      />

      <Tabs.Screen
        name="payroll"
        options={{
          href: isEmployer || isAgency || isAdmin ? undefined : null,
          title: 'Payroll',
          tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
        }}
      />

      <Tabs.Screen
        name="contracts"
        options={{
          href: isEmployer || isAgency || isAdmin ? undefined : null,
          title: 'Contracts',
          tabBarIcon: ({ color }) => <TabBarIcon name="file-text" color={color} />,
        }}
      />

      <Tabs.Screen
        name="documents"
        options={{
          href: isWorker ? undefined : null,
          title: 'Docs',
          tabBarIcon: ({ color }) => <TabBarIcon name="folder" color={color} />,
        }}
      />

      <Tabs.Screen
        name="panic"
        options={{
          href: isWorker ? undefined : null,
          title: 'Panic',
          tabBarIcon: ({ color }) => <TabBarIcon name="exclamation-triangle" color={color} />,
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          href: isWorker ? undefined : null,
          title: 'Chat',
          tabBarIcon: ({ color }) => <TabBarIcon name="comments" color={color} />,
        }}
      />

      <Tabs.Screen
        name="workers"
        options={{
          href: isEmployer || isAgency || isAdmin ? undefined : null,
          title: 'Workers',
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />

      <Tabs.Screen
        name="new-worker"
        options={{
          href: null,
          title: 'New Worker',
        }}
      />

      <Tabs.Screen
        name="employers"
        options={{
          href: isAgency || isAdmin ? undefined : null,
          title: 'Employers',
          tabBarIcon: ({ color }) => <TabBarIcon name="building" color={color} />,
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          href: isAuthority ? undefined : null,
          title: 'Search',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />

      <Tabs.Screen
        name="live-alerts"
        options={{
          href: isAuthority ? undefined : null,
          title: 'Alerts',
          tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />,
        }}
      />

      <Tabs.Screen
        name="incidents"
        options={{
          href: isAuthority || isEmployer ? undefined : null,
          title: 'Incidents',
          tabBarIcon: ({ color }) => <TabBarIcon name="warning" color={color} />,
        }}
      />

      <Tabs.Screen
        name="new-incident"
        options={{
          href: null,
          title: 'New Incident',
        }}
      />

      <Tabs.Screen
        name="attestation"
        options={{
          href: isAgency || isAdmin || appRole === 'embassy_source' || appRole === 'embassy_destination' || appRole === 'labour' ? undefined : null,
          title: 'Attest',
          tabBarIcon: ({ color }) => <TabBarIcon name="check-square" color={color} />,
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          href: isAuthority || isEmployer ? undefined : null,
          title: 'Reports',
          tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
        }}
      />

      <Tabs.Screen
        name="pricing"
        options={{
          href: isEmployer || isAgency ? undefined : null,
          title: 'Pricing',
          tabBarIcon: ({ color }) => <TabBarIcon name="credit-card" color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
