import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck } from 'lucide-react-native';
import { Card, EmptyState, Pill, Screen, TopBar } from '@/components/ui';
import { clubsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { ClubInvite, ClubSummary } from '@/types/api';
import { theme } from '@/theme';

type MyClubsPayload = {
  memberOf: ClubSummary[];
  sponsoring: ClubSummary[];
};

export default function ClubsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showMineOnly, setShowMineOnly] = useState(true);

  const { data: myClubs } = useQuery<MyClubsPayload>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((response) => response.data),
  });

  const { data: allClubs = [] } = useQuery<ClubSummary[]>({
    queryKey: ['clubs'],
    queryFn: () => clubsApi.getAll().then((response) => response.data),
  });

  const { data: invites = [] } = useQuery<ClubInvite[]>({
    queryKey: ['club-invites'],
    queryFn: () => clubsApi.getMyInvites().then((response) => response.data),
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      clubsApi.respondToInvite(inviteId, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onError: (error) => {
      Alert.alert('Could not respond to invite', getErrorMessage(error, 'Try again.'));
    },
  });

  const memberIds = new Set([...(myClubs?.memberOf || []).map((club) => club.id)]);
  const displayedClubs = showMineOnly
    ? [...(myClubs?.memberOf || []), ...(myClubs?.sponsoring || [])]
    : allClubs;

  return (
    <Screen scroll>
      <TopBar
        title="Clubs"
        subtitle="Membership, invites, sponsors, and club-only announcements."
      />

      {invites.length > 0 ? (
        <Card style={styles.invitesCard}>
          <Text style={styles.sectionTitle}>Pending Invites</Text>
          <View style={styles.stack}>
            {invites.map((invite) => (
              <Card key={invite.id} style={styles.inviteRow}>
                <View style={styles.inviteCopy}>
                  <Text style={styles.clubName}>{invite.club.name}</Text>
                  <Text style={styles.clubMeta}>
                    Invited by {invite.sender.firstName} {invite.sender.lastName}
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable onPress={() => respondMutation.mutate({ inviteId: invite.id, accept: true })}>
                    <Pill label="Accept" tone="green" />
                  </Pressable>
                  <Pressable onPress={() => respondMutation.mutate({ inviteId: invite.id, accept: false })}>
                    <Pill label="Decline" tone="neutral" />
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setShowMineOnly(true)}
            style={[styles.toggle, showMineOnly && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, showMineOnly && styles.toggleTextActive]}>My Clubs</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowMineOnly(false)}
            style={[styles.toggle, !showMineOnly && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, !showMineOnly && styles.toggleTextActive]}>All Clubs</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.stack}>
        {displayedClubs.length === 0 ? (
          <EmptyState
            title="No clubs to show"
            description="Clubs will appear here after you join one or when the school publishes active clubs."
          />
        ) : (
          displayedClubs.map((club) => (
            <Pressable
              key={club.id}
              onPress={() => router.push(`/clubs/${club.id}`)}
              style={({ pressed }) => [styles.clubCard, pressed && styles.clubCardPressed]}
            >
              <View style={styles.clubHeader}>
                <View style={styles.clubHeaderCopy}>
                  <Text style={styles.clubName}>{club.name}</Text>
                  <Text style={styles.clubMeta}>{club.description || 'No description provided.'}</Text>
                </View>
                {club.role === 'LEADER' ? <Pill label="Leader" tone="amber" /> : null}
                {!showMineOnly && memberIds.has(club.id) ? <Pill label="Member" tone="green" /> : null}
              </View>
              <View style={styles.clubFooter}>
                <View style={styles.memberRow}>
                  <BookOpenCheck size={15} color={theme.colors.textMuted} />
                  <Text style={styles.clubMeta}>{club._count?.members || 0} members</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  invitesCard: {
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
  inviteRow: {
    gap: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },
  inviteCopy: {
    gap: 4,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
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
  clubCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 10,
    ...theme.shadow.card,
  },
  clubCardPressed: {
    opacity: 0.88,
  },
  clubHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  clubHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  clubName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  clubMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  clubFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
});
