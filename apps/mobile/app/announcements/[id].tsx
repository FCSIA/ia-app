import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi, moderationApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Send, Flag, Trash2 } from 'lucide-react-native';
import { getUser } from '@/lib/auth';

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [user, setUser] = useState<any>(null);

  useState(() => { getUser().then(setUser); });

  const { data: ann, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.getOne(id).then((r) => r.data),
    enabled: !!id,
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => announcementsApi.addComment(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcement', id] }); setComment(''); },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (cid: string) => announcementsApi.deleteComment(cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcement', id] }),
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => moderationApi.submitReport({ contentType: 'ANNOUNCEMENT', contentId: id, reason }),
    onSuccess: () => Alert.alert('Reported', 'Your report has been submitted.'),
  });

  const handleReport = () => {
    Alert.prompt('Report Content', 'Describe the issue:', (reason) => {
      if (reason) reportMutation.mutate(reason);
    });
  };

  if (isLoading) return <View style={styles.center}><Text style={styles.loading}>Loading...</Text></View>;
  if (!ann) return <View style={styles.center}><Text>Not found</Text></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.chips}>
          {ann.isAdminGeneral && <View style={[styles.chip, { backgroundColor: '#fee2e2' }]}><Text style={[styles.chipText, { color: '#dc2626' }]}>Admin</Text></View>}
          <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
            <Text style={[styles.chipText, { color: '#1d4ed8' }]}>{ann.targetType.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{ann.title}</Text>
          <TouchableOpacity onPress={handleReport} style={styles.reportBtn}><Flag size={18} color="#9ca3af" /></TouchableOpacity>
        </View>

        <Text style={styles.meta}>
          {ann.author?.firstName} {ann.author?.lastName} · {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
        </Text>

        <Text style={styles.body}>{ann.body}</Text>

        {ann.allowComments && (
          <View style={styles.comments}>
            <Text style={styles.commentsTitle}>Comments ({ann.comments?.length || 0})</Text>
            {ann.comments?.map((c: any) => (
              <View key={c.id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{c.author.firstName[0]}</Text>
                </View>
                <View style={styles.commentBubble}>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentAuthor}>{c.author.firstName} {c.author.lastName}</Text>
                    <Text style={styles.commentTime}>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</Text>
                  </View>
                  <Text style={styles.commentBody}>{c.body}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {ann.allowComments && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment..."
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity
            onPress={() => comment.trim() && addCommentMutation.mutate(comment.trim())}
            disabled={!comment.trim()}
            style={[styles.sendBtn, !comment.trim() && styles.sendBtnDisabled]}
          >
            <Send size={18} color={comment.trim() ? '#fff' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: '#9ca3af' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111827', lineHeight: 26 },
  reportBtn: { padding: 4 },
  meta: { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  body: { fontSize: 15, color: '#374151', lineHeight: 23, marginBottom: 24 },
  comments: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  commentBubble: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 10 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#111827' },
  commentTime: { fontSize: 11, color: '#9ca3af' },
  commentBody: { fontSize: 13, color: '#374151' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#e5e7eb' },
});
