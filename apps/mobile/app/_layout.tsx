import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { getToken } from '@/lib/auth';
import { useRouter } from 'expo-router';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getToken().then((token) => {
      if (!token) router.replace('/login');
      setChecking(false);
    });
  }, []);

  if (checking) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="announcements/[id]" options={{ headerShown: true, title: 'Announcement', headerBackTitle: 'Back' }} />
        <Stack.Screen name="clubs/[id]" options={{ headerShown: true, title: 'Club', headerBackTitle: 'Back' }} />
        <Stack.Screen name="events/[id]" options={{ headerShown: true, title: 'Event', headerBackTitle: 'Back' }} />
      </Stack>
    </QueryClientProvider>
  );
}
