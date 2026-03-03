import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flexFridayApi } from '@/lib/api';
import { format } from 'date-fns';
import { Users, MapPin, CheckCircle, Circle } from 'lucide-react-native';

export default function FlexFridayScreen() {
  const qc = useQueryClient();
  const [selectedFriday, setSelectedFriday] = useState<any>(null);

  const { data: fridays = [], isLoading: loadingFridays, refetch } = useQuery({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((r) => r.data),
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['flex-sessions', selectedFriday?.id],
    queryFn: () => flexFridayApi.getSessions(selectedFriday.id).then((r) => r.data),
    enabled: !!selectedFriday,
  });

  const { data: myRegs = [] } = useQuery({
    queryKey: ['my-flex-registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((r) => r.data),
  });

  const myRegSessionIds = new Set((myRegs as any[]).map((r: any) => r.sessionId));

  const registerMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.register(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id, 'my-flex-registrations'] }),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Could not register'),
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.unregister(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id, 'my-flex-registrations'] }),
  });

  const typeColors: Record<string, { bg: string; text: string }> = {
    ALL_STUDENT: { bg: '#dbeafe', text: '#1d4ed8' },
    FRESHMAN_WORKSHOP: { bg: '#dcfce7', text: '#15803d' },
    PATHWAY_SPECIFIC: { bg: '#fef9c3', text: '#854d0e' },
    TEACHER_PD: { bg: '#fee2e2', text: '#dc2626' },
  };

  return (
    <View style={styles.container}>
      {!selectedFriday ? (
        <FlatList
          data={fridays as any[]}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loadingFridays} onRefresh={refetch} tintColor="#2563eb" />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.heading}>Upcoming Flex Fridays</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No Flex Fridays scheduled</Text>}
          renderItem={({ item }) => {
            const colors = typeColors[item.type] || { bg: '#f3f4f6', text: '#374151' };
            return (
              <TouchableOpacity style={styles.fridayCard} onPress={() => setSelectedFriday(item)}>
                <View style={styles.fridayCardLeft}>
                  <Text style={styles.fridayDate}>{format(new Date(item.date), 'EEE, MMM d')}</Text>
                  <View style={[styles.chip, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.chipText, { color: colors.text }]}>{item.type.replace(/_/g, ' ')}</Text>
                  </View>
                  {item.notes && <Text style={styles.notes} numberOfLines={1}>{item.notes}</Text>}
                </View>
                <View style={styles.sessionCount}>
                  <Text style={styles.sessionCountNum}>{item._count?.sessions || 0}</Text>
                  <Text style={styles.sessionCountLabel}>sessions</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <View style={styles.container}>
          <View style={styles.sessionsHeader}>
            <TouchableOpacity onPress={() => setSelectedFriday(null)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.sessionsTitle}>{format(new Date(selectedFriday.date), 'EEE, MMM d')}</Text>
          </View>

          <FlatList
            data={sessions as any[]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              loadingSessions
                ? <Text style={styles.empty}>Loading sessions...</Text>
                : <Text style={styles.empty}>No sessions available</Text>
            }
            renderItem={({ item }) => {
              const isRegistered = myRegSessionIds.has(item.id);
              const isFull = item.capacity && item._count?.registrations >= item.capacity;
              const isStudentChoice = item.sessionType === 'STUDENT_CHOICE';

              return (
                <View style={styles.sessionCard}>
                  <View style={styles.sessionTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>{item.title}</Text>
                      {item.sessionType === 'TEACHER_ASSIGNED' && (
                        <View style={[styles.chip, { backgroundColor: '#fef9c3', alignSelf: 'flex-start', marginTop: 4 }]}>
                          <Text style={[styles.chipText, { color: '#854d0e' }]}>Assigned</Text>
                        </View>
                      )}
                    </View>
                    {isStudentChoice && (
                      isRegistered ? (
                        <TouchableOpacity
                          onPress={() => unregisterMutation.mutate(item.id)}
                          style={styles.registeredBtn}
                        >
                          <CheckCircle size={16} color="#16a34a" />
                          <Text style={styles.registeredText}>Registered</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => !isFull && registerMutation.mutate(item.id)}
                          style={[styles.registerBtn, isFull && styles.registerBtnFull]}
                          disabled={!!isFull}
                        >
                          <Text style={[styles.registerBtnText, isFull && styles.registerBtnTextFull]}>
                            {isFull ? 'Full' : 'Register'}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>

                  {item.description && (
                    <Text style={styles.sessionDesc} numberOfLines={2}>{item.description}</Text>
                  )}

                  <View style={styles.sessionMeta}>
                    {item.location && (
                      <View style={styles.metaItem}>
                        <MapPin size={12} color="#9ca3af" />
                        <Text style={styles.metaText}>{item.location}</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Users size={12} color="#9ca3af" />
                      <Text style={styles.metaText}>
                        {item._count?.registrations}{item.capacity ? `/${item.capacity}` : ''} registered
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#9ca3af', fontSize: 14, paddingVertical: 32 },
  fridayCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  fridayCardLeft: { flex: 1 },
  fridayDate: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  chip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '600' },
  notes: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  sessionCount: { alignItems: 'center', paddingLeft: 16 },
  sessionCountNum: { fontSize: 22, fontWeight: '800', color: '#2563eb' },
  sessionCountLabel: { fontSize: 11, color: '#9ca3af' },
  sessionsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 15, color: '#2563eb', fontWeight: '600' },
  sessionsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  sessionCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sessionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  sessionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sessionDesc: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  sessionMeta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#9ca3af' },
  registeredBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  registeredText: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  registerBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  registerBtnFull: { backgroundColor: '#f3f4f6' },
  registerBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  registerBtnTextFull: { color: '#9ca3af' },
});
