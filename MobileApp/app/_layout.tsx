import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Colors from '@/constants/Colors';
import { SessionProvider, useSession } from '@/contexts/SessionContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const navTheme = React.useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.tint,
      background: Colors.light.background,
      card: Colors.light.card,
      text: Colors.light.text,
      border: Colors.light.border,
      notification: Colors.light.danger,
    },
  }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navTheme}>
          <OnboardingProvider>
            <SessionGate>
              <Stack>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="verify-email" options={{ headerShown: false }} />
                <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/start" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/worker" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/employer" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/agency" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/account" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/passport" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/company" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding/contact" options={{ headerShown: false }} />
                <Stack.Screen name="checkout/summary" options={{ headerShown: false }} />
                <Stack.Screen name="checkout/success" options={{ headerShown: false }} />
                <Stack.Screen name="checkout/cancel" options={{ headerShown: false }} />
                <Stack.Screen name="checkout/result" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="account" options={{ title: 'Account' }} />
                <Stack.Screen name="disputes" options={{ title: 'Disputes' }} />
                <Stack.Screen name="roster" options={{ title: 'Roster' }} />
                <Stack.Screen name="timesheets" options={{ title: 'Timesheets' }} />
                <Stack.Screen name="broadcast" options={{ title: 'Broadcast' }} />
                <Stack.Screen name="hrms" options={{ title: 'HRMS' }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              </Stack>
            </SessionGate>
          </OnboardingProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

// Routes where the complete-profile gate is intentionally bypassed so the
// user can still reach auth screens, the gate itself, and account editing.
const PROFILE_GATE_SKIP = new Set([
  'login',
  'verify-email',
  'complete-profile',
  'onboarding',
  'checkout',
  'account',
  'modal',
]);

function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    session
      .hydrate()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  // Auth gate: kick unauthenticated users to /login.
  useEffect(() => {
    if (!ready) return;
    if (!session.token) {
      router.replace('/login' as any);
    }
  }, [ready, session.token]);

  // Profile-complete gate: workers/employers/agencies must finish onboarding
  // before they can use the rest of the app.
  useEffect(() => {
    if (!ready || !session.token) return;
    let cancelled = false;
    (async () => {
      try {
        const base = (session.apiBaseUrl ?? '').replace(/\/+$/, '');
        const res = await fetch(`${base}/Api/Account/Profile`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${session.token}` },
        });
        if (!res.ok) {
          if (!cancelled) setProfileComplete(true);
          return;
        }
        const data = (await res.json()) as { profile?: { complete?: boolean } | null };
        const complete = data?.profile == null ? true : data.profile.complete !== false;
        if (!cancelled) setProfileComplete(complete);
      } catch {
        if (!cancelled) setProfileComplete(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session.token, session.apiBaseUrl]);

  useEffect(() => {
    if (!ready || !session.token || profileComplete !== false) return;
    const root = String(segments?.[0] ?? '');
    if (!PROFILE_GATE_SKIP.has(root)) {
      router.replace('/complete-profile' as any);
    }
  }, [ready, session.token, profileComplete, segments]);

  if (!ready) return null;
  return <>{children}</>;
}
