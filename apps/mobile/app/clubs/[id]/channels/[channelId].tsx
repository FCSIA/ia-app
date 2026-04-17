import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChevronLeft,
  Hash,
  Lock,
  Paperclip,
  Reply,
  Search,
  Sparkles,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import {
  AppButton,
  AppInput,
  Card,
  EmptyState,
  ModalSheet,
  Pill,
  Screen,
} from '@/components/ui';
import { clubsApi, toApiUrl, uploadsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { pathParam } from '@/lib/format';
import { getUser } from '@/lib/auth';
import { theme } from '@/theme';
import type {
  AppUser,
  ClubChannelMessage,
  ClubChannelMessageAttachment,
  ClubDetail,
} from '@/types/api';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '🎉', '👀'];

type MentionSuggestion = {
  token: string;
  label: string;
  kind: 'built-in' | 'tag' | 'person';
};

type ComposerMode = 'root' | 'thread';

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function formatBytes(size?: number | null) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}

function isImageAttachment(attachment: ClubChannelMessageAttachment) {
  return (
    attachment.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.fileName)
  );
}

function getSearchableText(message: ClubChannelMessage) {
  return [
    message.body,
    fullName(message.author),
    message.author.uniqueId,
    ...message.attachments.map((attachment) => attachment.fileName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getTrailingMentionQuery(value: string) {
  const match = value.match(/(?:^|\s)@([A-Za-z0-9_-]*)$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function replaceTrailingMention(value: string, token: string) {
  return value.replace(/(^|\s)@[A-Za-z0-9_-]*$/, (_match, leadingWhitespace: string) => {
    return `${leadingWhitespace}@${token} `;
  });
}

function AttachmentList({
  attachments,
}: {
  attachments: ClubChannelMessageAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <View style={styles.attachmentList}>
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => Linking.openURL(toApiUrl(attachment.fileUrl))}
          style={({ pressed }) => [styles.attachmentCard, pressed && styles.attachmentCardPressed]}
        >
          {isImageAttachment(attachment) ? (
            <Image source={{ uri: toApiUrl(attachment.fileUrl) }} style={styles.attachmentImage} />
          ) : null}
          <View style={styles.attachmentCopy}>
            <Text style={styles.attachmentName}>{attachment.fileName}</Text>
            <Text style={styles.attachmentMeta}>
              {attachment.mimeType || 'file'}
              {attachment.size ? ` · ${formatBytes(attachment.size)}` : ''}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ReactionStrip({
  message,
  onToggleReaction,
  disabled,
}: {
  message: ClubChannelMessage;
  onToggleReaction: (messageId: string, emoji: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.reactionStrip}>
      {message.reactions.map((reaction) => (
        <Pressable
          key={`${message.id}-${reaction.emoji}`}
          onPress={() => onToggleReaction(message.id, reaction.emoji)}
          disabled={disabled}
        >
          <Pill
            label={`${reaction.emoji} ${reaction.count}`}
            tone={reaction.reactedByCurrentUser ? 'accent' : 'neutral'}
          />
        </Pressable>
      ))}
    </View>
  );
}

function MessageCard({
  message,
  currentUserId,
  onOpenThread,
  onToggleReaction,
  reactionPending,
  compact = false,
}: {
  message: ClubChannelMessage;
  currentUserId?: string;
  onOpenThread: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  reactionPending: boolean;
  compact?: boolean;
}) {
  const isOwn = message.author.id === currentUserId;

  return (
    <Card style={[styles.messageCard, compact && styles.replyCard, isOwn && styles.ownMessageCard]}>
      <View style={styles.messageHeader}>
        <View style={styles.messageCopy}>
          <Text style={styles.messageAuthor}>{isOwn && !compact ? 'You' : fullName(message.author)}</Text>
          <Text style={styles.messageMeta}>
            {message.author.uniqueId} · {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </Text>
        </View>
        {!compact && message.replyCount > 0 ? (
          <Pill label={`${message.replyCount} replies`} tone="blue" />
        ) : null}
      </View>

      {message.body ? <Text style={styles.messageBody}>{message.body}</Text> : null}

      {message.mentions.length > 0 ? (
        <View style={styles.pillRow}>
          {message.mentions.map((mention) => (
            <Pill key={mention.id} label={`@${mention.token}`} tone="amber" />
          ))}
        </View>
      ) : null}

      <AttachmentList attachments={message.attachments} />

      <ReactionStrip
        message={message}
        onToggleReaction={onToggleReaction}
        disabled={reactionPending}
      />

      <View style={styles.messageFooter}>
        <Pressable onPress={() => onOpenThread(message.threadRootId)}>
          <Pill
            label={message.parentMessageId ? 'Open thread' : 'Reply in thread'}
            tone="neutral"
          />
        </Pressable>
        {!compact ? (
          <View style={styles.quickReactionRow}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={`${message.id}-${emoji}`}
                onPress={() => onToggleReaction(message.id, emoji)}
                disabled={reactionPending}
              >
                <Text style={styles.quickReactionText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function Composer({
  title,
  value,
  onValueChange,
  files,
  onPickFiles,
  onRemoveFile,
  onSubmit,
  isPending,
  helperTokens,
  suggestions,
}: {
  title: string;
  value: string;
  onValueChange: (value: string) => void;
  files: DocumentPicker.DocumentPickerAsset[];
  onPickFiles: () => void;
  onRemoveFile: (uri: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  helperTokens: string[];
  suggestions: MentionSuggestion[];
}) {
  const activeQuery = getTrailingMentionQuery(value);
  const visibleSuggestions = activeQuery
    ? suggestions
        .filter((entry) =>
          [entry.token, entry.label, entry.kind].join(' ').toLowerCase().includes(activeQuery),
        )
        .slice(0, 6)
    : [];

  return (
    <Card style={styles.composerCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.helperText}>
        Searchable chat with threads, reactions, inline files, and mention shortcuts.
      </Text>

      <View style={styles.helperChipRow}>
        {helperTokens.map((token) => (
          <Pressable
            key={token}
            onPress={() => {
              const suffix = value.trim().length > 0 && !value.endsWith(' ') ? ' ' : '';
              onValueChange(`${value}${suffix}${token} `);
            }}
          >
            <Pill label={token} tone="neutral" />
          </Pressable>
        ))}
      </View>

      <AppInput
        label="Message"
        placeholder="Type a message or @mention someone..."
        value={value}
        onChangeText={onValueChange}
        multiline
      />

      {visibleSuggestions.length > 0 ? (
        <View style={styles.suggestionList}>
          {visibleSuggestions.map((suggestion) => (
            <Pressable
              key={`${suggestion.kind}-${suggestion.token}`}
              onPress={() => onValueChange(replaceTrailingMention(value, suggestion.token))}
            >
              <Card style={styles.suggestionCard}>
                <Text style={styles.suggestionTitle}>@{suggestion.token}</Text>
                <Text style={styles.suggestionMeta}>
                  {suggestion.label} · {suggestion.kind}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      {files.length > 0 ? (
        <View style={styles.fileChipRow}>
          {files.map((file) => (
            <Pressable key={file.uri} onPress={() => onRemoveFile(file.uri)}>
              <Pill label={file.name} tone="blue" />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.composerActions}>
        <AppButton
          label="Attach"
          tone="secondary"
          onPress={onPickFiles}
          icon={<Paperclip size={16} color={theme.colors.textSoft} />}
          style={styles.flexButton}
        />
        <AppButton
          label={isPending ? 'Sending...' : 'Send'}
          onPress={onSubmit}
          disabled={!value.trim() && files.length === 0}
          loading={isPending}
          style={styles.flexButton}
        />
      </View>
    </Card>
  );
}

export default function ClubChannelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; channelId: string | string[] }>();
  const queryClient = useQueryClient();
  const id = pathParam(params.id);
  const channelId = pathParam(params.channelId);

  const [composerBody, setComposerBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [composerFiles, setComposerFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [replyFiles, setReplyFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const { data: currentUser } = useQuery<AppUser | null>({
    queryKey: ['mobile-current-user'],
    queryFn: () => getUser(),
  });

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

  const channel = useMemo(
    () => club?.channels?.find((entry) => entry.id === channelId),
    [channelId, club?.channels],
  );

  const audience = useMemo(() => {
    if (!club || !channel) return [];
    if (!channel.isPrivate) return club.directory;

    const memberIds = new Set(channel.memberships?.map((membership) => membership.userId) ?? []);
    return club.directory.filter(
      (person) => person.kind === 'SPONSOR' || memberIds.has(person.id),
    );
  }, [channel, club]);

  const suggestionEntries = useMemo<MentionSuggestion[]>(() => {
    const builtIns: MentionSuggestion[] = [
      { token: 'all', label: 'Everyone in this channel', kind: 'built-in' },
      { token: 'leaders', label: 'Members with club roles', kind: 'built-in' },
      { token: 'sponsors', label: 'Teacher sponsors', kind: 'built-in' },
    ];

    const tags =
      club?.tags?.map((tag) => ({
        token: tag.slug,
        label: tag.name,
        kind: 'tag' as const,
      })) ?? [];

    const people = audience
      .filter((person) => !!person.uniqueId)
      .map((person) => ({
        token: person.uniqueId!,
        label: fullName(person),
        kind: 'person' as const,
      }));

    return [...builtIns, ...tags, ...people];
  }, [audience, club?.tags]);

  const helperTokens = useMemo(() => {
    const tags = (club?.tags ?? []).slice(0, 4).map((tag) => `@${tag.slug}`);
    return ['@all', '@leaders', '@sponsors', ...tags];
  }, [club?.tags]);

  const flattenedMessages = useMemo(
    () => messages.flatMap((message) => [message, ...message.replies]),
    [messages],
  );

  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return messages;

    return messages.filter(
      (message) =>
        getSearchableText(message).includes(query) ||
        message.replies.some((reply) => getSearchableText(reply).includes(query)),
    );
  }, [messages, search]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return messages.find((message) => message.id === selectedThreadId) ?? null;
  }, [messages, selectedThreadId]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      body,
      files,
      parentMessageId,
    }: {
      body: string;
      files: DocumentPicker.DocumentPickerAsset[];
      parentMessageId?: string;
    }) => {
      const uploadedAttachments = await Promise.all(
        files.map((file) =>
          uploadsApi
            .uploadChatAttachment({
              uri: file.uri,
              name: file.name,
              mimeType: file.mimeType,
            })
            .then((response) => response.data),
        ),
      );

      return clubsApi.postChannelMessage(id, channelId, {
        body: body.trim() || undefined,
        parentMessageId,
        attachments: uploadedAttachments.map((attachment) => ({
          fileName: attachment.originalName,
          fileUrl: attachment.url,
          mimeType: attachment.mimeType,
          size: attachment.size,
        })),
      });
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['club-channel-messages', id, channelId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });

      if (variables.parentMessageId) {
        setReplyBody('');
        setReplyFiles([]);
      } else {
        setComposerBody('');
        setComposerFiles([]);
      }
    },
    onError: (error) => {
      Alert.alert('Could not send message', getErrorMessage(error, 'Try again.'));
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      clubsApi.toggleChannelReaction(id, channelId, messageId, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-channel-messages', id, channelId] });
    },
    onError: (error) => {
      Alert.alert('Could not update reaction', getErrorMessage(error, 'Try again.'));
    },
  });

  async function pickFiles(mode: ComposerMode) {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const assets = result.assets ?? [];
    if (assets.length === 0) return;

    if (mode === 'thread') {
      setReplyFiles((current) => [
        ...current,
        ...assets.filter((asset) => !current.some((entry) => entry.uri === asset.uri)),
      ]);
      return;
    }

    setComposerFiles((current) => [
      ...current,
      ...assets.filter((asset) => !current.some((entry) => entry.uri === asset.uri)),
    ]);
  }

  if (!club || !channel) {
    return (
      <Screen scroll>
        <EmptyState
          title="Channel not found"
          description="You may not have access to this club channel."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.colors.textSoft} />
        </Pressable>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            {channel.isPrivate ? (
              <Lock size={14} color={theme.colors.textSoft} />
            ) : (
              <Hash size={14} color={theme.colors.textSoft} />
            )}
            <Text style={styles.title}>{channel.name}</Text>
          </View>
          <Text style={styles.subtitle}>
            {channel.description || 'Threads, reactions, files, and mentions are live here.'}
          </Text>
        </View>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Sparkles size={16} color={theme.colors.accentDark} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Modern club chat</Text>
            <Text style={styles.heroText}>
              Search the lane, react in place, push side conversations into threads, and keep sponsors visible everywhere.
            </Text>
          </View>
        </View>
        <View style={styles.pillRow}>
          <Pill label={channel.isPrivate ? 'Private' : 'Open'} tone={channel.isPrivate ? 'amber' : 'green'} />
          <Pill label={`${visibleMessages.length} threads`} tone="blue" />
          <Pill label={`${audience.length} visible`} tone="neutral" />
        </View>
      </Card>

      <Card style={styles.searchCard}>
        <AppInput
          label="Search channel"
          placeholder="Search messages, files, or people"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.inlineRow}>
          <Search size={15} color={theme.colors.textSoft} />
          <Text style={styles.helperText}>
            {search.trim()
              ? `${flattenedMessages.filter((message) => getSearchableText(message).includes(search.trim().toLowerCase())).length} matches in this channel`
              : 'Search across roots, replies, attachment names, and people.'}
          </Text>
        </View>
      </Card>

      <Composer
        title="Channel composer"
        value={composerBody}
        onValueChange={setComposerBody}
        files={composerFiles}
        onPickFiles={() => pickFiles('root')}
        onRemoveFile={(uri) =>
          setComposerFiles((current) => current.filter((file) => file.uri !== uri))
        }
        onSubmit={() =>
          sendMessageMutation.mutate({
            body: composerBody,
            files: composerFiles,
          })
        }
        isPending={sendMessageMutation.isPending}
        helperTokens={helperTokens}
        suggestions={suggestionEntries}
      />

      <View style={styles.list}>
        {visibleMessages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Start the channel with an announcement, a screenshot, or a quick check-in."
          />
        ) : (
          visibleMessages.map((message) => (
            <View key={message.id} style={styles.threadStack}>
              <MessageCard
                message={message}
                currentUserId={currentUser?.id}
                onOpenThread={setSelectedThreadId}
                onToggleReaction={(messageId, emoji) =>
                  reactionMutation.mutate({ messageId, emoji })
                }
                reactionPending={reactionMutation.isPending}
              />

              {message.replies.length > 0 ? (
                <Pressable onPress={() => setSelectedThreadId(message.id)}>
                  <Card style={styles.replyPreviewCard}>
                    <View style={styles.inlineRow}>
                      <Reply size={15} color={theme.colors.textSoft} />
                      <Text style={styles.helperText}>
                        {message.replies.length} repl{message.replies.length === 1 ? 'y' : 'ies'} in this thread
                      </Text>
                    </View>
                    {message.replies.slice(0, 2).map((reply) => (
                      <View key={reply.id} style={styles.replyPreviewRow}>
                        <Text style={styles.replyPreviewAuthor}>{fullName(reply.author)}</Text>
                        <Text style={styles.replyPreviewBody} numberOfLines={1}>
                          {reply.body || reply.attachments.map((attachment) => attachment.fileName).join(', ')}
                        </Text>
                      </View>
                    ))}
                  </Card>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      <ModalSheet
        visible={!!selectedThread}
        onClose={() => setSelectedThreadId(null)}
        title={selectedThread ? `Thread · ${fullName(selectedThread.author)}` : 'Thread'}
      >
        {selectedThread ? (
          <View style={styles.threadModalContent}>
            <MessageCard
              message={selectedThread}
              currentUserId={currentUser?.id}
              onOpenThread={setSelectedThreadId}
              onToggleReaction={(messageId, emoji) =>
                reactionMutation.mutate({ messageId, emoji })
              }
              reactionPending={reactionMutation.isPending}
            />

            {selectedThread.replies.length ? (
              selectedThread.replies.map((reply) => (
                <MessageCard
                  key={reply.id}
                  message={reply}
                  currentUserId={currentUser?.id}
                  onOpenThread={setSelectedThreadId}
                  onToggleReaction={(messageId, emoji) =>
                    reactionMutation.mutate({ messageId, emoji })
                  }
                  reactionPending={reactionMutation.isPending}
                  compact
                />
              ))
            ) : (
              <EmptyState
                title="No replies yet"
                description="Replies stay in this thread so the main channel stays readable."
              />
            )}

            <Composer
              title="Reply in thread"
              value={replyBody}
              onValueChange={setReplyBody}
              files={replyFiles}
              onPickFiles={() => pickFiles('thread')}
              onRemoveFile={(uri) =>
                setReplyFiles((current) => current.filter((file) => file.uri !== uri))
              }
              onSubmit={() =>
                sendMessageMutation.mutate({
                  body: replyBody,
                  files: replyFiles,
                  parentMessageId: selectedThread.id,
                })
              }
              isPending={sendMessageMutation.isPending}
              helperTokens={helperTokens}
              suggestions={suggestionEntries}
            />
          </View>
        ) : null}
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
  heroCard: {
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchCard: {
    gap: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  composerCard: {
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  helperChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fileChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  suggestionList: {
    gap: 8,
  },
  suggestionCard: {
    gap: 4,
    backgroundColor: theme.colors.surfaceMuted,
  },
  suggestionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  list: {
    gap: 12,
  },
  threadStack: {
    gap: 8,
  },
  messageCard: {
    gap: 10,
  },
  ownMessageCard: {
    borderColor: 'rgba(249, 115, 22, 0.18)',
    backgroundColor: 'rgba(255, 247, 237, 0.92)',
  },
  replyCard: {
    marginLeft: 18,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  messageCopy: {
    flex: 1,
    gap: 4,
  },
  messageAuthor: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  messageMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  messageBody: {
    color: theme.colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentList: {
    gap: 8,
  },
  attachmentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  attachmentCardPressed: {
    opacity: 0.88,
  },
  attachmentImage: {
    width: '100%',
    height: 160,
    backgroundColor: theme.colors.backgroundSoft,
  },
  attachmentCopy: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  attachmentName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  attachmentMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  reactionStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  quickReactionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickReactionText: {
    fontSize: 18,
  },
  replyPreviewCard: {
    gap: 8,
    backgroundColor: theme.colors.surfaceMuted,
  },
  replyPreviewRow: {
    gap: 2,
  },
  replyPreviewAuthor: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  replyPreviewBody: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  threadModalContent: {
    gap: 12,
  },
});
