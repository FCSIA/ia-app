import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Hash, Lock } from 'lucide-react-native';
import { clubsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { pathParam } from '@/lib/format';
import { AppButton, AppInput, Card, Pill, Screen } from '@/components/ui';
import { theme } from '@/theme';
import type { ClubChannelMessage, ClubDetail } from '@/types/api';
import { formatDistanceToNow } from 'date-fns';

export default function ClubChannelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; channelId: string | string[] }>();
  const queryClient = useQueryClient();
  const id = pathParam(params.id);
  const channelId = pathParam(params.channelId);
  const [messageBody, setMessageBody] = useState('');

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((response) => response.data),
    enabled: !!id,
  });

  const { data: messages = [] } = useQuery<ClubChannelMessage[]>({
    queryKey: ['club-channel-messages', id, channelId],
    queryFn: () => clubsApi.getChannelMessages(id, channelId).then((response) => response.data),
    enabled: !!id && !!channelId,
  });

  const postMutation = useMutation({
    mutationFn: () => clubsApi.postChannelMessage(id, channelId, messageBody),
    onSuccess: () => {
      setMessageBody('');
      queryClient.invalidateQueries({ queryKey: ['club-channel-messages', id, channelId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (error) => {
      alert(getErrorMessage(error, 'Could not send message.'));
    },
  });

  const channel = useMemo(
    () => club?.channels?.find((entry) => entry.id === channelId),
    [club?.channels, channelId],
  );

  return (
    <Screen scroll keyboard>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.colors.textSoft} />
        </Pressable>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            {channel?.isPrivate ? (
              <Lock size={14} color={theme.colors.textSoft} />
            ) : (
              <Hash size={14} color={theme.colors.textSoft} />
            )}
            <Text style={styles.title}>{channel?.name || 'Channel'}</Text>
          </View>
          <Text style={styles.subtitle}>{channel?.description || 'Club channel messages and mentions.'}</Text>
        </View>
      </View>

      <Card style={styles.composerCard}>
        <Text style={styles.sectionTitle}>Post a message</Text>
        <Text style={styles.helper}>Use @all, @leaders, @sponsors, @STU001, or custom @tags.</Text>
        <AppInput
          label="Message"
          placeholder="Write a message..."
          value={messageBody}
          onChangeText={setMessageBody}
          multiline
        />
        <AppButton
          label={postMutation.isPending ? 'Sending...' : 'Send Message'}
          onPress={() => postMutation.mutate()}
          disabled={!messageBody.trim()}
        />
      </Card>

      <View style={styles.list}>
        {messages.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No messages yet.</Text>
          </Card>
        ) : (
          messages.map((message) => (
            <Card key={message.id}>
              <View style={styles.messageHeader}>
                <View>
                  <Text style={styles.messageAuthor}>
                    {message.author.firstName} {message.author.lastName}
                  </Text>
                  <Text style={styles.messageMeta}>
                    {message.author.uniqueId} · {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                  </Text>
                </View>
                {message.mentions.length ? (
                  <Pill label={`${message.mentions.length} mention${message.mentions.length > 1 ? 's' : ''}`} tone="amber" />
                ) : null}
              </View>
              <Text style={styles.messageBody}>{message.body}</Text>
            </Card>
          ))
        )}
      </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  composerCard: {
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  helper: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  messageAuthor: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  messageMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  messageBody: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
});
