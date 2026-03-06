import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Plus, X } from 'lucide-react-native';
import { Card, ModalSheet, Pill, Screen, AppButton, AppInput } from '@/components/ui';
import { clubsApi, eventsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTimeRange } from '@/lib/format';
import { getUser, hasRole } from '@/lib/auth';
import type { AppUser, ClubSummary, EventRecord } from '@/types/api';
import { theme } from '@/theme';

type ClubCollection = {
  memberOf?: ClubSummary[];
  sponsoring?: ClubSummary[];
};

type EventFormState = {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  clubId: string;
};

const initialForm: EventFormState = {
  title: '',
  description: '',
  location: '',
  startAt: '',
  endAt: '',
  clubId: '',
};

export default function EventsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AppUser | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<EventFormState>(initialForm);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: events = [] } = useQuery<EventRecord[]>({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((response) => response.data),
  });

  const { data: myClubs } = useQuery<ClubCollection>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((response) => response.data),
  });

  const { data: pendingApprovals = [] } = useQuery<EventRecord[]>({
    queryKey: ['pending-approvals'],
    queryFn: () => eventsApi.getPendingApprovals().then((response) =>
      response.data.map((approval: any) => approval.event),
    ),
    enabled: !!user && hasRole(user, 'SPONSOR'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => eventsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setForm(initialForm);
      setShowComposer(false);
    },
    onError: (error) => {
      Alert.alert('Could not create event', getErrorMessage(error, 'Try again.'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => eventsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => eventsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => eventsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
  });

  const canCreate = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF', 'STUDENT_LEADER');
  const upcomingEvents = useMemo(
    () =>
      events.filter((event) => event.status === 'PUBLISHED' && new Date(event.startAt) >= new Date()),
    [events],
  );
  const pastEvents = useMemo(
    () =>
      events.filter((event) => event.status === 'PUBLISHED' && new Date(event.startAt) < new Date()),
    [events],
  );

  const availableClubs = [
    ...(myClubs?.memberOf || []),
    ...(myClubs?.sponsoring || []),
  ].filter((club, index, list) => list.findIndex((item) => item.id === club.id) === index);

  function updateForm<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submitEvent() {
    if (!form.title.trim() || !form.startAt.trim()) {
      Alert.alert('Missing fields', 'Title and start time are required.');
      return;
    }

    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      startAt: form.startAt.trim(),
      endAt: form.endAt.trim() || undefined,
      clubId: form.clubId || undefined,
    });
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.colors.textSoft} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>Published events, pending approvals, and event creation.</Text>
        </View>
        {canCreate ? (
          <Pressable onPress={() => setShowComposer(true)} style={styles.composeButton}>
            <Plus size={18} color="#ffffff" />
          </Pressable>
        ) : null}
      </View>

      {pendingApprovals.length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.blockTitle}>Pending Approval</Text>
          <View style={styles.stack}>
            {pendingApprovals.map((event) => (
              <Card key={event.id} style={styles.innerCard}>
                <View style={styles.rowSplit}>
                  <View style={styles.stackTight}>
                    <View style={styles.pills}>
                      <Pill label={event.status.replace(/_/g, ' ')} tone="amber" />
                      {event.club?.name ? <Pill label={event.club.name} tone="blue" /> : null}
                    </View>
                    <Text style={styles.cardTitle}>{event.title}</Text>
                    <Text style={styles.cardMeta}>{formatDateTimeRange(event.startAt, event.endAt)}</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <AppButton
                    label="Approve"
                    onPress={() => approveMutation.mutate(event.id)}
                    style={styles.flexButton}
                    icon={<Check size={16} color="#ffffff" />}
                  />
                  <AppButton
                    label="Reject"
                    tone="danger"
                    onPress={() => rejectMutation.mutate(event.id)}
                    style={styles.flexButton}
                    icon={<X size={16} color={theme.colors.red} />}
                  />
                </View>
              </Card>
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>Upcoming Events</Text>
        <View style={styles.stack}>
          {upcomingEvents.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming events are published.</Text>
          ) : (
            upcomingEvents.map((event) => (
              <Card key={event.id} style={styles.innerCard}>
                <View style={styles.pills}>
                  <Pill label={event.status.replace(/_/g, ' ')} tone="green" />
                  <Pill label={event.club?.name || event.type} tone="blue" />
                </View>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.cardMeta}>{formatDateTimeRange(event.startAt, event.endAt)}</Text>
                {event.location ? <Text style={styles.cardMeta}>{event.location}</Text> : null}
                {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
                {!!user &&
                (hasRole(user, 'ADMIN', 'SUPER_ADMIN') || event.authorId === user.id) ? (
                  <View style={styles.actionRow}>
                    <AppButton
                      label="Cancel Event"
                      tone="danger"
                      onPress={() => cancelMutation.mutate(event.id)}
                      style={styles.flexButton}
                    />
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      </Card>

      {pastEvents.length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.blockTitle}>Past Events</Text>
          <View style={styles.stack}>
            {pastEvents.slice(0, 4).map((event) => (
              <Card key={event.id} style={styles.innerCard}>
                <View style={styles.pills}>
                  <Pill label={event.club?.name || event.type} tone="neutral" />
                </View>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.cardMeta}>{formatDateTimeRange(event.startAt, event.endAt)}</Text>
              </Card>
            ))}
          </View>
        </Card>
      ) : null}

      <ModalSheet visible={showComposer} onClose={() => setShowComposer(false)} title="Create Event">
        <AppInput label="Title" placeholder="Event title" value={form.title} onChangeText={(value) => updateForm('title', value)} />
        <AppInput
          label="Description"
          placeholder="What is happening?"
          value={form.description}
          onChangeText={(value) => updateForm('description', value)}
          multiline
        />
        <AppInput label="Location" placeholder="Optional location" value={form.location} onChangeText={(value) => updateForm('location', value)} />
        <AppInput
          label="Start (ISO)"
          placeholder="2026-03-20T15:30:00.000Z"
          value={form.startAt}
          onChangeText={(value) => updateForm('startAt', value)}
        />
        <AppInput
          label="End (optional ISO)"
          placeholder="2026-03-20T17:00:00.000Z"
          value={form.endAt}
          onChangeText={(value) => updateForm('endAt', value)}
        />
        {availableClubs.length > 0 ? (
          <View style={styles.stack}>
            <Text style={styles.fieldLabel}>Club Event (optional)</Text>
            <View style={styles.choiceRow}>
              <Pressable onPress={() => updateForm('clubId', '')}>
                <Pill label="General" tone={form.clubId ? 'neutral' : 'accent'} />
              </Pressable>
              {availableClubs.map((club) => (
                <Pressable key={club.id} onPress={() => updateForm('clubId', club.id)}>
                  <Pill label={club.name} tone={form.clubId === club.id ? 'accent' : 'neutral'} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.actionRow}>
          <AppButton
            label="Create Event"
            onPress={submitEvent}
            loading={createMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton
            label="Cancel"
            tone="secondary"
            onPress={() => setShowComposer(false)}
            style={styles.flexButton}
          />
        </View>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  composeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.glow,
  },
  block: {
    gap: 14,
  },
  blockTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  stack: {
    gap: 10,
  },
  stackTight: {
    flex: 1,
    gap: 6,
  },
  innerCard: {
    gap: 10,
    backgroundColor: theme.colors.surfaceMuted,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  description: {
    color: theme.colors.textSoft,
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
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
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
