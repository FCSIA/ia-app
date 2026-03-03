import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { notificationsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react-native';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  SCHOOL_ANNOUNCEMENT: { bg: '#dbeafe', text: '#1d4ed8' },
  CLUB_ANNOUNCEMENT: { bg: '#dcfce7', text: '#15803d' },
  EVENT: { bg: '#fef9c3', text: '#854d0e' },
  FLEX_FRIDAY: { bg: '#f3f4f6', text: '#374151' },
};

export default function NotificationsScreen() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll().then((r) => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
  });

  const unreadCount = (notifications as any[]).filter((n) => !n.isRead).length;

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllMutation.mutate()}>
          <Text style={styles.markAllText}>Mark all {unreadCount} as read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications as any[]}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#2563eb" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const colors = CATEGORY_COLORS[item.category] || { bg: '#f3f4f6', text: '#374151' };
          return (
            <TouchableOpacity
              style={[styles.card, !item.isRead && styles.cardUnread]}
              onPress={() => !item.isRead && markReadMutation.mutate(item.id)}
            >
              <View style={[styles.unreadDot, { opacity: item.isRead ? 0 : 1 }]} />
              <View style={{ flex: 1 }}>
                <View style={[styles.chip, { backgroundColor: colors.bg, alignSelf: 'flex-start', marginBottom: 4 }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{item.category.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.notifTitle}>{item.title}</Text>
                {item.body ? <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text> : null}
                <Text style={styles.notifTime}>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  markAllBtn: { backgroundColor: '#eff6ff', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  markAllText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6',
  },
  cardUnread: { borderColor: '#dbeafe', backgroundColor: '#f0f7ff' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb', marginTop: 6, flexShrink: 0 },
  chip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '700' },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  notifBody: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  notifTime: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
