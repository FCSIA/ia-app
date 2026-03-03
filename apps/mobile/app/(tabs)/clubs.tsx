import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { clubsApi } from '@/lib/api';
import { Users } from 'lucide-react-native';

export default function ClubsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: myData, isLoading, refetch } = useQuery({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((r) => r.data),
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['club-invites'],
    queryFn: () => clubsApi.getMyInvites().then((r) => r.data),
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      clubsApi.respondToInvite(inviteId, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-invites', 'my-clubs'] }),
  });

  const clubs = myData?.memberOf || [];

  return (
    <View style={styles.container}>
      <FlatList
        data={clubs as any[]}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#2563eb" />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          (invites as any[]).length > 0 ? (
            <View style={styles.inviteSection}>
              <Text style={styles.sectionTitle}>Pending Invites</Text>
              {(invites as any[]).map((inv: any) => (
                <View key={inv.id} style={styles.inviteCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteName}>{inv.club.name}</Text>
                    <Text style={styles.inviteMeta}>
                      From {inv.sender.firstName} {inv.sender.lastName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => respondMutation.mutate({ inviteId: inv.id, accept: true })}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => respondMutation.mutate({ inviteId: inv.id, accept: false })}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Users size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>You are not in any clubs yet</Text>
            <Text style={styles.emptyHint}>Clubs are invite-only. Ask a club leader or sponsor to invite you.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/clubs/${item.id}` as any)}>
            <View style={styles.cardHeader}>
              <Text style={styles.clubName}>{item.name}</Text>
              {item.role === 'LEADER' && (
                <View style={styles.leaderBadge}>
                  <Text style={styles.leaderBadgeText}>Leader</Text>
                </View>
              )}
            </View>
            {item.description && (
              <Text style={styles.clubDesc} numberOfLines={2}>{item.description}</Text>
            )}
            <View style={styles.memberRow}>
              <Users size={13} color="#9ca3af" />
              <Text style={styles.memberCount}>{item._count?.members} members</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, paddingBottom: 32 },
  inviteSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb',
    borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#fef08a', gap: 8,
  },
  inviteName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  inviteMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  acceptBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  declineBtn: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  declineBtnText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 6, paddingHorizontal: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  clubName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  leaderBadge: { backgroundColor: '#fef9c3', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  leaderBadgeText: { fontSize: 11, fontWeight: '700', color: '#854d0e' },
  clubDesc: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberCount: { fontSize: 12, color: '#9ca3af' },
});
