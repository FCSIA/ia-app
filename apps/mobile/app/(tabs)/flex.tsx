import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react-native';
import { AppButton, AppInput, Card, ModalSheet, Pill, Screen, TopBar } from '@/components/ui';
import { flexFridayApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { format } from 'date-fns';
import { getUser, hasRole } from '@/lib/auth';
import type { AppUser, FlexFridayRecord, FlexRegistration, FlexSession } from '@/types/api';
import { theme } from '@/theme';

type FridayForm = {
  date: string;
  type: 'ALL_STUDENT' | 'FRESHMAN_WORKSHOP' | 'PATHWAY_SPECIFIC' | 'TEACHER_PD';
  notes: string;
};

type SessionForm = {
  title: string;
  description: string;
  location: string;
  capacity: string;
  sessionType: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNED';
};

const initialFridayForm: FridayForm = {
  date: '',
  type: 'ALL_STUDENT',
  notes: '',
};

const initialSessionForm: SessionForm = {
  title: '',
  description: '',
  location: '',
  capacity: '',
  sessionType: 'STUDENT_CHOICE',
};

export default function FlexFridayScreen() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AppUser | null>(null);
  const [selectedFriday, setSelectedFriday] = useState<FlexFridayRecord | null>(null);
  const [showFridayComposer, setShowFridayComposer] = useState(false);
  const [showSessionComposer, setShowSessionComposer] = useState(false);
  const [fridayForm, setFridayForm] = useState<FridayForm>(initialFridayForm);
  const [sessionForm, setSessionForm] = useState<SessionForm>(initialSessionForm);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: fridays = [] } = useQuery<FlexFridayRecord[]>({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((response) => response.data),
  });

  const { data: sessions = [] } = useQuery<FlexSession[]>({
    queryKey: ['flex-sessions', selectedFriday?.id],
    queryFn: () => flexFridayApi.getSessions(selectedFriday!.id).then((response) => response.data),
    enabled: !!selectedFriday,
  });

  const { data: registrations = [] } = useQuery<FlexRegistration[]>({
    queryKey: ['my-flex-registrations'],
    queryFn: () => flexFridayApi.getMyRegistrations().then((response) => response.data),
  });

  const registerMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.register(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-flex-registrations'] });
    },
    onError: (error) => {
      Alert.alert('Could not register', getErrorMessage(error, 'Try again.'));
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId: string) => flexFridayApi.unregister(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-flex-registrations'] });
    },
    onError: (error) => {
      Alert.alert('Could not unregister', getErrorMessage(error, 'Try again.'));
    },
  });

  const createFridayMutation = useMutation({
    mutationFn: (payload: FridayForm) => flexFridayApi.createFriday(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex-fridays'] });
      setFridayForm(initialFridayForm);
      setShowFridayComposer(false);
    },
    onError: (error) => {
      Alert.alert('Could not schedule Flex Friday', getErrorMessage(error, 'Try again.'));
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (payload: any) => flexFridayApi.createSession(selectedFriday!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex-sessions', selectedFriday?.id] });
      setSessionForm(initialSessionForm);
      setShowSessionComposer(false);
    },
    onError: (error) => {
      Alert.alert('Could not create session', getErrorMessage(error, 'Try again.'));
    },
  });

  const registeredSessionIds = new Set(registrations.map((registration) => registration.sessionId));
  const canManageDays = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canManageSessions = !!user && hasRole(user, 'TEACHER', 'ADMIN', 'SUPER_ADMIN');

  const selectedDayLabel = selectedFriday
    ? format(new Date(selectedFriday.date), 'EEEE, MMMM d')
    : 'Pick a Flex Friday';

  function submitFriday() {
    if (!fridayForm.date.trim()) {
      Alert.alert('Date required');
      return;
    }

    createFridayMutation.mutate(fridayForm);
  }

  function submitSession() {
    if (!sessionForm.title.trim()) {
      Alert.alert('Title required');
      return;
    }

    createSessionMutation.mutate({
      title: sessionForm.title.trim(),
      description: sessionForm.description.trim() || undefined,
      location: sessionForm.location.trim() || undefined,
      capacity: sessionForm.capacity ? Number(sessionForm.capacity) : undefined,
      sessionType: sessionForm.sessionType,
    });
  }

  return (
    <Screen scroll>
      <TopBar
        title="Flex Friday"
        subtitle="Browse dates, register for sessions, or publish new schedules."
        right={
          canManageDays ? (
            <Pressable onPress={() => setShowFridayComposer(true)} style={styles.composeButton}>
              <Plus size={18} color="#ffffff" />
            </Pressable>
          ) : undefined
        }
      />

      <Card style={styles.splitCard}>
        <Text style={styles.sectionTitle}>Scheduled Fridays</Text>
        <View style={styles.stack}>
          {fridays.length === 0 ? (
            <Text style={styles.emptyText}>No Flex Fridays scheduled yet.</Text>
          ) : (
            fridays.map((friday) => (
              <Pressable
                key={friday.id}
                onPress={() => setSelectedFriday(friday)}
                style={[
                  styles.fridayItem,
                  selectedFriday?.id === friday.id && styles.fridayItemActive,
                ]}
              >
                <View style={styles.fridayCopy}>
                  <Text style={styles.itemTitle}>{format(new Date(friday.date), 'EEE, MMM d, yyyy')}</Text>
                  <Text style={styles.itemMeta}>{friday.type.replace(/_/g, ' ')}</Text>
                  {friday.notes ? <Text style={styles.itemMeta}>{friday.notes}</Text> : null}
                </View>
                <Pill label={`${friday._count?.sessions || 0} sessions`} tone="neutral" />
              </Pressable>
            ))
          )}
        </View>
      </Card>

      <Card style={styles.splitCard}>
        <View style={styles.sessionsHeader}>
          <View style={styles.sessionsCopy}>
            <Text style={styles.sectionTitle}>{selectedDayLabel}</Text>
            {selectedFriday ? <Text style={styles.itemMeta}>Session list for this day.</Text> : null}
          </View>
          {selectedFriday && canManageSessions ? (
            <AppButton
              label="Add Session"
              tone="secondary"
              onPress={() => setShowSessionComposer(true)}
            />
          ) : null}
        </View>
        {!selectedFriday ? (
          <Text style={styles.emptyText}>Choose a Flex Friday above to view sessions.</Text>
        ) : sessions.length === 0 ? (
          <Text style={styles.emptyText}>No sessions posted yet.</Text>
        ) : (
          <View style={styles.stack}>
            {sessions.map((session) => {
              const isRegistered = registeredSessionIds.has(session.id);
              const isFull = !!session.capacity && (session._count?.registrations || 0) >= session.capacity;
              const studentChoice = session.sessionType === 'STUDENT_CHOICE';

              return (
                <Card key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionCopy}>
                      <View style={styles.pillRow}>
                        <Pill
                          label={session.sessionType === 'STUDENT_CHOICE' ? 'Choice' : 'Assigned'}
                          tone={studentChoice ? 'green' : 'amber'}
                        />
                        {session.capacity ? (
                          <Pill label={`${session._count?.registrations || 0}/${session.capacity}`} tone="neutral" />
                        ) : null}
                      </View>
                      <Text style={styles.itemTitle}>{session.title}</Text>
                      {session.location ? <Text style={styles.itemMeta}>{session.location}</Text> : null}
                      {session.description ? <Text style={styles.itemMeta}>{session.description}</Text> : null}
                    </View>
                  </View>
                  {studentChoice ? (
                    <View style={styles.actionRow}>
                      {isRegistered ? (
                        <AppButton
                          label="Leave Session"
                          tone="secondary"
                          onPress={() => unregisterMutation.mutate(session.id)}
                          style={styles.flexButton}
                        />
                      ) : (
                        <AppButton
                          label={isFull ? 'Session Full' : 'Register'}
                          onPress={() => registerMutation.mutate(session.id)}
                          disabled={isFull}
                          style={styles.flexButton}
                        />
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </Card>

      <ModalSheet visible={showFridayComposer} onClose={() => setShowFridayComposer(false)} title="Schedule Flex Friday">
        <AppInput
          label="Date"
          placeholder="YYYY-MM-DD"
          value={fridayForm.date}
          onChangeText={(value) => setFridayForm((current) => ({ ...current, date: value }))}
        />
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.choiceRow}>
            {(['ALL_STUDENT', 'FRESHMAN_WORKSHOP', 'PATHWAY_SPECIFIC', 'TEACHER_PD'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setFridayForm((current) => ({ ...current, type }))}
              >
                <Pill label={type.replace(/_/g, ' ')} tone={fridayForm.type === type ? 'accent' : 'neutral'} />
              </Pressable>
            ))}
          </View>
        </View>
        <AppInput
          label="Notes"
          placeholder="Optional notes"
          value={fridayForm.notes}
          onChangeText={(value) => setFridayForm((current) => ({ ...current, notes: value }))}
          multiline
        />
        <View style={styles.actionRow}>
          <AppButton
            label="Schedule Day"
            onPress={submitFriday}
            loading={createFridayMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton label="Cancel" tone="secondary" onPress={() => setShowFridayComposer(false)} style={styles.flexButton} />
        </View>
      </ModalSheet>

      <ModalSheet visible={showSessionComposer} onClose={() => setShowSessionComposer(false)} title="Create Session">
        <AppInput
          label="Title"
          placeholder="Session title"
          value={sessionForm.title}
          onChangeText={(value) => setSessionForm((current) => ({ ...current, title: value }))}
        />
        <AppInput
          label="Description"
          placeholder="Optional description"
          value={sessionForm.description}
          onChangeText={(value) => setSessionForm((current) => ({ ...current, description: value }))}
          multiline
        />
        <AppInput
          label="Location"
          placeholder="Optional location"
          value={sessionForm.location}
          onChangeText={(value) => setSessionForm((current) => ({ ...current, location: value }))}
        />
        <AppInput
          label="Capacity"
          placeholder="Optional capacity"
          value={sessionForm.capacity}
          onChangeText={(value) => setSessionForm((current) => ({ ...current, capacity: value }))}
          keyboardType="numeric"
        />
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>Session Type</Text>
          <View style={styles.choiceRow}>
            {(['STUDENT_CHOICE', 'TEACHER_ASSIGNED'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setSessionForm((current) => ({ ...current, sessionType: type }))}
              >
                <Pill label={type.replace(/_/g, ' ')} tone={sessionForm.sessionType === type ? 'accent' : 'neutral'} />
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.actionRow}>
          <AppButton
            label="Create Session"
            onPress={submitSession}
            loading={createSessionMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton label="Cancel" tone="secondary" onPress={() => setShowSessionComposer(false)} style={styles.flexButton} />
        </View>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.glow,
  },
  splitCard: {
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stack: {
    gap: 10,
  },
  fridayItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
  },
  fridayItemActive: {
    borderColor: 'rgba(249, 115, 22, 0.2)',
    backgroundColor: theme.colors.accentSoft,
  },
  fridayCopy: {
    flex: 1,
    gap: 4,
  },
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  sessionsCopy: {
    flex: 1,
    gap: 4,
  },
  sessionCard: {
    gap: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },
  sessionHeader: {
    flexDirection: 'row',
  },
  sessionCopy: {
    flex: 1,
    gap: 6,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  itemMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  fieldLabel: {
    color: theme.colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
