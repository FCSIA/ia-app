import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { announcementsApi, eventsApi, notificationsApi, flexFridayApi } from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth';
import { format, formatDistanceToNow } from 'date-fns';
import { Bell, LogOut } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getUser().then(setUser); }, []);

  const { data: announcements = [], refetch: refetchAnn } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.getAll().then((r) => r.data),
  });

  const { data: events = [], refetch: refetchEvents } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((r) => r.data),
  });

  const { data: notifData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const upcomingEvents = (events as any[])
    .filter((e) => e.status === 'PUBLISHED' && new Date(e.startAt) >= new Date())
    .slice(0, 3);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAnn(), refetchEvents()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/login');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName} 👋</Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications' as any)}>
            <Bell size={22} color="#374151" />
            {notifData?.count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifData.count > 9 ? '9+' : notifData.count}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}>
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.statNum, { color: '#2563eb' }]}>{(announcements as any[]).length}</Text>
          <Text style={styles.statLabel}>Announcements</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.statNum, { color: '#16a34a' }]}>{upcomingEvents.length}</Text>
          <Text style={styles.statLabel}>Upcoming Events</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fefce8' }]}>
          <Text style={[styles.statNum, { color: '#ca8a04' }]}>{notifData?.count || 0}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
      </View>

      {/* Recent announcements */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Announcements</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/announcements')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {(announcements as any[]).slice(0, 4).map((a) => (
          <TouchableOpacity
            key={a.id}
            style={styles.listItem}
            onPress={() => router.push(`/announcements/${a.id}` as any)}
          >
            <Text style={styles.itemTitle} numberOfLines={1}>{a.title}</Text>
            <Text style={styles.itemMeta}>
              {a.author?.firstName} {a.author?.lastName} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
            </Text>
          </TouchableOpacity>
        ))}
        {!(announcements as any[]).length && (
          <Text style={styles.emptyText}>No announcements</Text>
        )}
      </View>

      {/* Upcoming events */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity onPress={() => router.push('/events' as any)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {upcomingEvents.map((e: any) => (
          <TouchableOpacity
            key={e.id}
            style={styles.listItem}
            onPress={() => router.push(`/events/${e.id}` as any)}
          >
            <Text style={styles.itemTitle} numberOfLines={1}>{e.title}</Text>
            <Text style={styles.itemMeta}>{format(new Date(e.startAt), 'EEE, MMM d · h:mm a')}</Text>
          </TouchableOpacity>
        ))}
        {!upcomingEvents.length && <Text style={styles.emptyText}>No upcoming events</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#111827' },
  date: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { position: 'relative', padding: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  listItem: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6',
  },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
});
