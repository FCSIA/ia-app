import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { authApi } from '@/lib/api';
import { clearAuth, getToken, getUser, setAuth } from '@/lib/auth';
import { theme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function SessionGate() {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading');
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let active = true;

    async function hydrateSession() {
      const token = await getToken();
      if (!token) {
        if (active) setStatus('out');
        return;
      }

      try {
        const storedUser = await getUser();
        const response = await authApi.me();
        if (active) {
          await setAuth(token, response.data ?? storedUser);
          setStatus('in');
        }
      } catch {
        await clearAuth();
        if (active) setStatus('out');
      }
    }

    hydrateSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthArea = segments[0] === 'login';
    if (status === 'in' && inAuthArea) router.replace('/(tabs)');
    if (status === 'out' && !inAuthArea) router.replace('/login');
  }, [router, segments, status]);

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="announcements/[id]" />
      <Stack.Screen name="clubs/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="events" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <SessionGate />
    </QueryClientProvider>
  );
}
