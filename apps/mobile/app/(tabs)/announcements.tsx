import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { announcementsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const [archived, setArchived] = useState(false);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['announcements', archived],
    queryFn: () => announcementsApi.getAll(archived).then((r) => r.data),
  });

  const statusColors: Record<string, string> = {
    ACTIVE: '#dbeafe',
    EXPIRED: '#f3f4f6',
    ARCHIVED: '#f3f4f6',
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, !archived && styles.tabActive]}
          onPress={() => setArchived(false)}
        >
          <Text style={[styles.tabText, !archived && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, archived && styles.tabActive]}
          onPress={() => setArchived(true)}
        >
          <Text style={[styles.tabText, archived && styles.tabTextActive]}>Archived</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data as any[]}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#2563eb" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{archived ? 'No archived announcements' : 'No announcements yet'}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/announcements/${item.id}` as any)}
          >
            <View style={styles.cardTop}>
              {item.isAdminGeneral && (
                <View style={[styles.chip, { backgroundColor: '#fee2e2' }]}>
                  <Text style={[styles.chipText, { color: '#dc2626' }]}>Admin</Text>
                </View>
              )}
              <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                <Text style={[styles.chipText, { color: '#1d4ed8' }]}>{item.targetType.replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.author?.firstName} {item.author?.lastName} ·{' '}
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#2563eb' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, paddingVertical: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 },
  meta: { fontSize: 12, color: '#9ca3af' },
});
