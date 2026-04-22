import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
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
  const colorScheme = useColorScheme();

  const navTheme = React.useMemo(() => {
    const scheme = colorScheme === 'dark' ? 'dark' : 'light';
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: Colors[scheme].tint,
        background: Colors[scheme].background,
        card: (Colors as any)[scheme].card ?? base.colors.card,
        text: Colors[scheme].text,
        border: (Colors as any)[scheme].border ?? base.colors.border,
        notification: (Colors as any)[scheme].danger ?? base.colors.notification,
      },
    };
  }, [colorScheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navTheme}>
          <OnboardingProvider>
            <SessionGate>
              <Stack>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="checkout" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              </Stack>
            </SessionGate>
          </OnboardingProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    session
      .hydrate()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session.token) {
      router.replace('/login' as any);
    }
  }, [ready, session.token]);

  if (!ready) return null;
  return <>{children}</>;
}
