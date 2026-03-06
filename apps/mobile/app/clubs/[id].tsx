import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Crown, Megaphone, UserMinus, UserPlus } from 'lucide-react-native';
import {
  AppButton,
  AppInput,
  Avatar,
  Card,
  ModalSheet,
  Pill,
  Screen,
} from '@/components/ui';
import { announcementsApi, clubsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatDistanceToNow } from 'date-fns';
import { getUser, hasRole } from '@/lib/auth';
import { initials, pathParam } from '@/lib/format';
import type { AnnouncementSummary, AppUser, ClubDetail } from '@/types/api';
import { theme } from '@/theme';

type TabKey = 'announcements' | 'members';

export default function ClubDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const queryClient = useQueryClient();
  const id = pathParam(params.id);
  const [user, setUser] = useState<AppUser | null>(null);
  const [tab, setTab] = useState<TabKey>('announcements');
  const [showInvite, setShowInvite] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [inviteValue, setInviteValue] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [allowComments, setAllowComments] = useState(false);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((response) => response.data),
    enabled: !!id,
  });

  const { data: clubAnnouncements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((response) => response.data),
    enabled: !!id && tab === 'announcements',
  });

  const inviteMutation = useMutation({
    mutationFn: (recipientId: string) => clubsApi.sendInvite(id, recipientId),
    onSuccess: () => {
      setInviteValue('');
      setShowInvite(false);
      Alert.alert('Invite sent');
    },
    onError: (error) => {
      Alert.alert('Could not send invite', getErrorMessage(error, 'Try again.'));
    },
  });

  const postMutation = useMutation({
    mutationFn: () =>
      announcementsApi.create({
        title: postTitle.trim(),
        body: postBody.trim(),
        targetType: 'CLUB',
        clubId: id,
        allowComments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-announcements', id] });
      setShowPost(false);
      setPostTitle('');
      setPostBody('');
      setAllowComments(false);
    },
    onError: (error) => {
      Alert.alert('Could not post to club', getErrorMessage(error, 'Try again.'));
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.promoteMember(id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
    },
    onError: (error) => {
      Alert.alert('Could not promote member', getErrorMessage(error, 'Try again.'));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.removeMember(id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
    },
    onError: (error) => {
      Alert.alert('Could not remove member', getErrorMessage(error, 'Try again.'));
    },
  });

  const isSponsor = useMemo(
    () => !!club?.sponsors?.some((sponsor) => sponsor.userId === user?.id),
    [club?.sponsors, user?.id],
  );
  const myMembership = useMemo(
    () => club?.members?.find((member) => member.userId === user?.id),
    [club?.members, user?.id],
  );
  const isLeader = myMembership?.role === 'LEADER';
  const canPost = !!user && (isSponsor || isLeader || hasRole(user, 'ADMIN', 'SUPER_ADMIN'));
  const canManageMembers = !!user && (isSponsor || hasRole(user, 'ADMIN', 'SUPER_ADMIN'));

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.colors.textSoft} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{club?.name || 'Club'}</Text>
          <Text style={styles.subtitle}>{club?.description || 'Club details and member-only posts.'}</Text>
        </View>
      </View>

      {club ? (
        <>
          <Card style={styles.summaryCard}>
            <View style={styles.pills}>
              {isSponsor ? <Pill label="Sponsor" tone="blue" /> : null}
              {isLeader ? <Pill label="Leader" tone="amber" /> : null}
              <Pill label={`${club.members.length} members`} tone="neutral" />
            </View>
            <Text style={styles.summaryText}>
              Sponsors:{' '}
              {club.sponsors.map((sponsor) => `${sponsor.user.firstName} ${sponsor.user.lastName}`).join(', ')}
            </Text>
            <View style={styles.actionRow}>
              {(canManageMembers || isLeader) && (
                <AppButton
                  label="Invite Member"
                  tone="secondary"
                  onPress={() => setShowInvite(true)}
                  icon={<UserPlus size={16} color={theme.colors.textSoft} />}
                  style={styles.flexButton}
                />
              )}
              {canPost ? (
                <AppButton
                  label="Post Update"
                  onPress={() => setShowPost(true)}
                  icon={<Megaphone size={16} color="#ffffff" />}
                  style={styles.flexButton}
                />
              ) : null}
            </View>
          </Card>

          <Card>
            <View style={styles.toggleRow}>
              <Pressable onPress={() => setTab('announcements')} style={[styles.toggle, tab === 'announcements' && styles.toggleActive]}>
                <Text style={[styles.toggleText, tab === 'announcements' && styles.toggleTextActive]}>Announcements</Text>
              </Pressable>
              <Pressable onPress={() => setTab('members')} style={[styles.toggle, tab === 'members' && styles.toggleActive]}>
                <Text style={[styles.toggleText, tab === 'members' && styles.toggleTextActive]}>Members</Text>
              </Pressable>
            </View>
          </Card>

          {tab === 'announcements' ? (
            <View style={styles.stack}>
              {clubAnnouncements.length === 0 ? (
                <Card>
                  <Text style={styles.emptyText}>No club posts yet.</Text>
                </Card>
              ) : (
                clubAnnouncements.map((announcement) => (
                  <Pressable
                    key={announcement.id}
                    onPress={() => router.push(`/announcements/${announcement.id}`)}
                    style={({ pressed }) => [styles.announcementCard, pressed && styles.announcementCardPressed]}
                  >
                    <View style={styles.pills}>
                      <Pill label={announcement.allowComments ? 'Comments on' : 'Comments off'} tone={announcement.allowComments ? 'green' : 'neutral'} />
                    </View>
                    <Text style={styles.cardTitle}>{announcement.title}</Text>
                    <Text style={styles.cardMeta}>
                      {announcement.author?.firstName} {announcement.author?.lastName} ·{' '}
                      {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : (
            <View style={styles.stack}>
              {club.sponsors.map((sponsor) => (
                <Card key={sponsor.userId} style={styles.memberCard}>
                  <Avatar label={initials(sponsor.user.firstName, sponsor.user.lastName)} />
                  <View style={styles.memberCopy}>
                    <Text style={styles.cardTitle}>
                      {sponsor.user.firstName} {sponsor.user.lastName}
                    </Text>
                    <Text style={styles.cardMeta}>Sponsor</Text>
                  </View>
                </Card>
              ))}

              {club.members.map((member) => (
                <Card key={member.userId} style={styles.memberCard}>
                  <Avatar label={initials(member.user.firstName, member.user.lastName)} />
                  <View style={styles.memberCopy}>
                    <View style={styles.memberTitleRow}>
                      <Text style={styles.cardTitle}>
                        {member.user.firstName} {member.user.lastName}
                      </Text>
                      {member.role === 'LEADER' ? (
                        <Pill label="Leader" tone="amber" />
                      ) : null}
                    </View>
                    <Text style={styles.cardMeta}>{member.user.uniqueId}</Text>
                  </View>
                  {canManageMembers && member.userId !== user?.id ? (
                    <View style={styles.memberActions}>
                      {member.role === 'MEMBER' && isSponsor ? (
                        <Pressable onPress={() => promoteMutation.mutate(member.userId)}>
                          <Crown size={16} color={theme.colors.amber} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => removeMutation.mutate(member.userId)}>
                        <UserMinus size={16} color={theme.colors.red} />
                      </Pressable>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </>
      ) : (
        <Card>
          <Text style={styles.emptyText}>Loading club details...</Text>
        </Card>
      )}

      <ModalSheet visible={showInvite} onClose={() => setShowInvite(false)} title="Invite Member">
        <AppInput
          label="User ID"
          placeholder="Student or staff unique ID"
          value={inviteValue}
          onChangeText={setInviteValue}
          autoCapitalize="characters"
        />
        <View style={styles.actionRow}>
          <AppButton
            label="Send Invite"
            onPress={() => inviteMutation.mutate(inviteValue.trim().toUpperCase())}
            loading={inviteMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton label="Cancel" tone="secondary" onPress={() => setShowInvite(false)} style={styles.flexButton} />
        </View>
      </ModalSheet>

      <ModalSheet visible={showPost} onClose={() => setShowPost(false)} title="New Club Post">
        <AppInput label="Title" placeholder="Post title" value={postTitle} onChangeText={setPostTitle} />
        <AppInput label="Body" placeholder="Write your update..." value={postBody} onChangeText={setPostBody} multiline />
        <Pressable onPress={() => setAllowComments((current) => !current)}>
          <Pill label="Allow comments" tone={allowComments ? 'green' : 'neutral'} />
        </Pressable>
        <View style={styles.actionRow}>
          <AppButton
            label="Post Update"
            onPress={() => postMutation.mutate()}
            loading={postMutation.isPending}
            style={styles.flexButton}
          />
          <AppButton label="Cancel" tone="secondary" onPress={() => setShowPost(false)} style={styles.flexButton} />
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
  summaryCard: {
    gap: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  flexButton: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
  },
  memberCopy: {
    flex: 1,
    gap: 4,
  },
  memberTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
