import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Plus } from 'lucide-react-native';
import {
  AppButton,
  AppInput,
  Card,
  ModalSheet,
  Pill,
  Screen,
  SectionTitle,
  TopBar,
} from '@/components/ui';
import { announcementsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatDistanceToNow } from 'date-fns';
import { getUser, hasRole } from '@/lib/auth';
import type { AnnouncementSummary, AppUser } from '@/types/api';
import { theme } from '@/theme';

type TargetType = 'SCHOOL_WIDE' | 'GRADE' | 'PATHWAY';

type AnnouncementForm = {
  title: string;
  body: string;
  targetType: TargetType;
  targetGrade: string;
  targetPathway: 'INFORMATION_TECHNOLOGY' | 'HEALTH_SCIENCE' | 'ENGINEERING';
  allowComments: boolean;
  isAdminGeneral: boolean;
};

const initialForm: AnnouncementForm = {
  title: '',
  body: '',
  targetType: 'SCHOOL_WIDE',
  targetGrade: '9',
  targetPathway: 'INFORMATION_TECHNOLOGY',
  allowComments: false,
  isAdminGeneral: false,
};

export default function AnnouncementsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AppUser | null>(null);
  const [archived, setArchived] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState<AnnouncementForm>(initialForm);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: announcements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['announcements', archived],
    queryFn: () => announcementsApi.getAll(archived).then((response) => response.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => announcementsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setShowComposer(false);
      setForm(initialForm);
    },
    onError: (error) => {
      Alert.alert('Could not create announcement', getErrorMessage(error, 'Try again.'));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error) => {
      Alert.alert('Could not archive announcement', getErrorMessage(error, 'Try again.'));
    },
  });

  const canCreate = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');
  const announcementRows = useMemo(() => announcements, [announcements]);

  function updateForm<K extends keyof AnnouncementForm>(key: K, value: AnnouncementForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submitAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) {
      Alert.alert('Missing fields', 'Title and body are required.');
      return;
    }

    createMutation.mutate({
      title: form.title.trim(),
      body: form.body.trim(),
      targetType: form.targetType,
      targetGrade: form.targetType === 'GRADE' ? Number(form.targetGrade) : undefined,
      targetPathway: form.targetType === 'PATHWAY' ? form.targetPathway : undefined,
      allowComments: form.allowComments,
      isAdminGeneral: form.isAdminGeneral,
    });
  }

  return (
    <Screen scroll>
      <TopBar
        title="Announcements"
        subtitle="School-wide updates and targeted communications."
        right={
          canCreate ? (
            <Pressable onPress={() => setShowComposer(true)} style={styles.composeButton}>
              <Plus size={18} color="#ffffff" />
            </Pressable>
          ) : undefined
        }
      />

      <Card>
        <SectionTitle title="View" />
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setArchived(false)}
            style={[styles.toggle, !archived && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, !archived && styles.toggleTextActive]}>Active</Text>
          </Pressable>
          <Pressable
            onPress={() => setArchived(true)}
            style={[styles.toggle, archived && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, archived && styles.toggleTextActive]}>Archived</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.stack}>
        {announcementRows.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>
              {archived ? 'No archived announcements right now.' : 'No announcements have been posted yet.'}
            </Text>
          </Card>
        ) : (
          announcementRows.map((announcement) => (
            <Pressable
              key={announcement.id}
              onPress={() => router.push(`/announcements/${announcement.id}`)}
              style={({ pressed }) => [styles.announcementCard, pressed && styles.announcementCardPressed]}
            >
              <View style={styles.headerRow}>
                <View style={styles.pills}>
                  {announcement.isAdminGeneral ? <Pill label="Admin" tone="red" /> : null}
                  <Pill label={announcement.targetType.replace(/_/g, ' ')} tone="blue" />
                  {announcement.status !== 'ACTIVE' ? (
                    <Pill label={announcement.status.replace(/_/g, ' ')} tone="neutral" />
                  ) : null}
                </View>
                {!!user && (hasRole(user, 'ADMIN', 'SUPER_ADMIN') || announcement.author?.id === user.id) ? (
                  <Pressable onPress={() => archiveMutation.mutate(announcement.id)} style={styles.archiveButton}>
                    <Archive size={16} color={theme.colors.textSoft} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.cardTitle}>{announcement.title}</Text>
              <Text style={styles.cardMeta}>
                {announcement.author?.firstName} {announcement.author?.lastName} ·{' '}
                {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
              </Text>
              {announcement.expiresAt ? (
                <Text style={styles.cardMeta}>
                  Expires {formatDistanceToNow(new Date(announcement.expiresAt), { addSuffix: true })}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </View>

      <ModalSheet visible={showComposer} onClose={() => setShowComposer(false)} title="New Announcement">
        <AppInput label="Title" placeholder="Announcement title" value={form.title} onChangeText={(value) => updateForm('title', value)} />
        <AppInput
          label="Body"
          placeholder="Write your announcement..."
          value={form.body}
          onChangeText={(value) => updateForm('body', value)}
          multiline
        />
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>Target</Text>
          <View style={styles.choiceRow}>
            {(['SCHOOL_WIDE', 'GRADE', 'PATHWAY'] as TargetType[]).map((target) => (
              <Pressable key={target} onPress={() => updateForm('targetType', target)}>
                <Pill
                  label={target.replace(/_/g, ' ')}
                  tone={form.targetType === target ? 'accent' : 'neutral'}
                />
              </Pressable>
            ))}
          </View>
        </View>
        {form.targetType === 'GRADE' ? (
          <View style={styles.stack}>
            <Text style={styles.fieldLabel}>Grade</Text>
            <View style={styles.choiceRow}>
              {['9', '10', '11', '12'].map((grade) => (
                <Pressable key={grade} onPress={() => updateForm('targetGrade', grade)}>
                  <Pill label={`Grade ${grade}`} tone={form.targetGrade === grade ? 'accent' : 'neutral'} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {form.targetType === 'PATHWAY' ? (
          <View style={styles.stack}>
            <Text style={styles.fieldLabel}>Pathway</Text>
            <View style={styles.choiceRow}>
              {(['INFORMATION_TECHNOLOGY', 'HEALTH_SCIENCE', 'ENGINEERING'] as const).map((pathway) => (
                <Pressable key={pathway} onPress={() => updateForm('targetPathway', pathway)}>
                  <Pill
                    label={pathway.replace(/_/g, ' ')}
                    tone={form.targetPathway === pathway ? 'accent' : 'neutral'}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.choiceRow}>
          <Pressable onPress={() => updateForm('allowComments', !form.allowComments)}>
            <Pill label="Allow comments" tone={form.allowComments ? 'green' : 'neutral'} />
          </Pressable>
          {!!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN') ? (
            <Pressable onPress={() => updateForm('isAdminGeneral', !form.isAdminGeneral)}>
              <Pill label="Notify everyone" tone={form.isAdminGeneral ? 'amber' : 'neutral'} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.actionRow}>
          <AppButton
            label="Post Announcement"
            onPress={submitAnnouncement}
            loading={createMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton label="Cancel" tone="secondary" onPress={() => setShowComposer(false)} style={styles.flexButton} />
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  toggle: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: theme.colors.text,
  },
  stack: {
    gap: 10,
  },
  announcementCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 8,
    ...theme.shadow.card,
  },
  announcementCardPressed: {
    opacity: 0.88,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  archiveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
