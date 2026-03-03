import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { clubsApi, announcementsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Users, Crown } from 'lucide-react-native';

type Tab = 'announcements' | 'members';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('announcements');

  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
    enabled: !!id,
  });

  const { data: announcements = [], isLoading: annLoading, refetch } = useQuery({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((r) => r.data),
    enabled: !!id && tab === 'announcements',
  });

  if (clubLoading) return <View style={styles.center}><Text style={styles.loading}>Loading...</Text></View>;
  if (!club) return <View style={styles.center}><Text>Club not found</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{club.name}</Text>
        {club.description && <Text style={styles.clubDesc}>{club.description}</Text>}
        <View style={styles.sponsorRow}>
          {club.sponsors?.map((s: any) => (
            <Text key={s.userId} style={styles.sponsorText}>Sponsor: {s.user.firstName} {s.user.lastName}</Text>
          ))}
        </View>
      </View>

      <View style={styles.tabs}>
        {(['announcements', 'members'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'members' ? ` (${club.members?.length || 0})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'announcements' ? (
        <FlatList
          data={announcements as any[]}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={annLoading} onRefresh={refetch} tintColor="#2563eb" />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No posts yet</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.annCard} onPress={() => router.push(`/announcements/${item.id}` as any)}>
              <Text style={styles.annTitle}>{item.title}</Text>
              <Text style={styles.annMeta}>
                {item.author?.firstName} {item.author?.lastName} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={club.members}
          keyExtractor={(item: any) => item.userId}
          contentContainerStyle={styles.list}
          renderItem={({ item }: any) => (
            <View style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{item.user.firstName[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{item.user.firstName} {item.user.lastName}</Text>
                <Text style={styles.memberId}>{item.user.uniqueId}</Text>
              </View>
              {item.role === 'LEADER' && (
                <View style={styles.leaderBadge}>
                  <Crown size={11} color="#854d0e" />
                  <Text style={styles.leaderText}>Leader</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: '#9ca3af' },
  clubInfo: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  clubName: { fontSize: 20, fontWeight: '800', color: '#111827' },
  clubDesc: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  sponsorRow: { marginTop: 6 },
  sponsorText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#2563eb' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, paddingVertical: 32 },
  annCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6',
  },
  annTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  annMeta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  memberName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  memberId: { fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' },
  leaderBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef9c3', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  leaderText: { fontSize: 11, fontWeight: '700', color: '#854d0e' },
});
