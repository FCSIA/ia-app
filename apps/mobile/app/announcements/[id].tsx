import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Flag, Trash2 } from 'lucide-react-native';
import {
  AppButton,
  AppInput,
  Avatar,
  Card,
  ModalSheet,
  Pill,
  Screen,
} from '@/components/ui';
import { announcementsApi, moderationApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatDistanceToNow } from 'date-fns';
import { getUser, hasRole } from '@/lib/auth';
import { initials, pathParam } from '@/lib/format';
import type { AnnouncementDetail, AppUser } from '@/types/api';
import { theme } from '@/theme';

export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = pathParam(params.id);
  const [user, setUser] = useState<AppUser | null>(null);
  const [comment, setComment] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: announcement } = useQuery<AnnouncementDetail>({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.getOne(id).then((response) => response.data),
    enabled: !!id,
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => announcementsApi.addComment(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
      setComment('');
    },
    onError: (error) => {
      Alert.alert('Could not add comment', getErrorMessage(error, 'Try again.'));
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => announcementsApi.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
    },
    onError: (error) => {
      Alert.alert('Could not delete comment', getErrorMessage(error, 'Try again.'));
    },
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      moderationApi.submitReport({
        contentType: 'ANNOUNCEMENT',
        contentId: id,
        reason: reportReason.trim(),
      }),
    onSuccess: () => {
      setReportReason('');
      setShowReport(false);
      Alert.alert('Report submitted');
    },
    onError: (error) => {
      Alert.alert('Could not submit report', getErrorMessage(error, 'Try again.'));
    },
  });

  function submitComment() {
    if (!comment.trim()) return;
    addCommentMutation.mutate(comment.trim());
  }

  return (
    <Screen scroll keyboard>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <ChevronLeft size={20} color={theme.colors.textSoft} />
        </Pressable>
        <Pressable onPress={() => setShowReport(true)} style={styles.headerButton}>
          <Flag size={18} color={theme.colors.textSoft} />
        </Pressable>
      </View>

      {!announcement ? (
        <Card>
          <Text style={styles.emptyText}>Loading announcement...</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.mainCard}>
            <View style={styles.pills}>
              {announcement.isAdminGeneral ? <Pill label="Admin" tone="red" /> : null}
              <Pill label={announcement.targetType.replace(/_/g, ' ')} tone="blue" />
              {announcement.status !== 'ACTIVE' ? (
                <Pill label={announcement.status.replace(/_/g, ' ')} tone="neutral" />
              ) : null}
            </View>
            <Text style={styles.title}>{announcement.title}</Text>
            <Text style={styles.meta}>
              {announcement.author?.firstName} {announcement.author?.lastName} ·{' '}
              {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
            </Text>
            <Text style={styles.body}>{announcement.body}</Text>
          </Card>

          {announcement.allowComments ? (
            <Card style={styles.commentsCard}>
              <Text style={styles.commentsTitle}>
                Comments ({announcement.comments?.length || 0})
              </Text>
              <View style={styles.commentList}>
                {announcement.comments?.length ? (
                  announcement.comments.map((entry) => (
                    <View key={entry.id} style={styles.commentRow}>
                      <Avatar label={initials(entry.author.firstName, entry.author.lastName)} />
                      <View style={styles.commentBubble}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentAuthor}>
                            {entry.author.firstName} {entry.author.lastName}
                          </Text>
                          <View style={styles.commentHeaderRight}>
                            <Text style={styles.commentTime}>
                              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                            </Text>
                            {!!user &&
                            (entry.authorId === user.id || hasRole(user, 'ADMIN', 'SUPER_ADMIN')) ? (
                              <Pressable onPress={() => deleteCommentMutation.mutate(entry.id)}>
                                <Trash2 size={14} color={theme.colors.red} />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                        <Text style={styles.commentBody}>{entry.body}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No comments yet.</Text>
                )}
              </View>

              <View style={styles.composer}>
                <AppInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Write a comment..."
                  multiline
                />
                <AppButton
                  label="Post Comment"
                  onPress={submitComment}
                  loading={addCommentMutation.isPending}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.emptyText}>Comments are disabled for this announcement.</Text>
            </Card>
          )}
        </>
      )}

      <ModalSheet visible={showReport} onClose={() => setShowReport(false)} title="Report Announcement">
        <AppInput
          label="Reason"
          placeholder="Describe the issue with this announcement."
          value={reportReason}
          onChangeText={setReportReason}
          multiline
        />
        <View style={styles.actionRow}>
          <AppButton
            label="Submit Report"
            onPress={() => reportMutation.mutate()}
            loading={reportMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton label="Cancel" tone="secondary" onPress={() => setShowReport(false)} style={styles.flexButton} />
        </View>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCard: {
    gap: 10,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    color: theme.colors.textSoft,
    fontSize: 15,
    lineHeight: 24,
  },
  commentsCard: {
    gap: 14,
  },
  commentsTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  commentList: {
    gap: 12,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  commentBubble: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12,
    gap: 6,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  commentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentAuthor: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  commentTime: {
    color: theme.colors.textFaint,
    fontSize: 11,
  },
  commentBody: {
    color: theme.colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    gap: 12,
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
});
