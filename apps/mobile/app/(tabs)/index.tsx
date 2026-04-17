import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  LogOut,
  Megaphone,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { announcementsApi, authApi, eventsApi, flexFridayApi, notificationsApi } from '@/lib/api';
import { clearAuth, getUser } from '@/lib/auth';
import { AppButton, Card, MetricCard, Pill, Screen, SectionTitle, TopBar } from '@/components/ui';
import { formatDateTimeRange } from '@/lib/format';
import type { AnnouncementSummary, AppUser, EventRecord, FlexFridayRecord } from '@/types/api';
import { theme } from '@/theme';

function IconChip({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconChip, pressed && styles.iconChipPressed]}>
      {children}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const { data: announcements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.getAll().then((response) => response.data),
  });

  const { data: events = [] } = useQuery<EventRecord[]>({
    queryKey: ['events'],
    queryFn: () => eventsApi.getAll().then((response) => response.data),
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((response) => response.data),
    refetchInterval: 30_000,
  });

  const { data: flexFridays = [] } = useQuery<FlexFridayRecord[]>({
    queryKey: ['flex-fridays'],
    queryFn: () => flexFridayApi.getAll().then((response) => response.data),
  });

  const upcomingEvents = events
    .filter((event) => event.status === 'PUBLISHED' && new Date(event.startAt) >= new Date())
    .slice(0, 3);
  const latestAnnouncements = announcements.slice(0, 4);
  const nextFriday = flexFridays.find((friday) => new Date(friday.date) >= new Date());

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Best effort logout only.
    }
    await clearAuth();
    router.replace('/login');
  }

  return (
    <Screen scroll>
      <TopBar
        title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ''}`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
        right={
          <>
            <IconChip onPress={() => router.push('/notifications')}>
              <Bell size={18} color={theme.colors.textSoft} />
              {(unread?.count || 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread!.count > 9 ? '9+' : unread!.count}</Text>
                </View>
              ) : null}
            </IconChip>
            <IconChip onPress={handleLogout}>
              <LogOut size={18} color={theme.colors.red} />
            </IconChip>
          </>
        }
      />

      <Card style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Sparkles size={16} color={theme.colors.accentDark} />
        </View>
        <Text style={styles.heroTitle}>School operations, trimmed for mobile.</Text>
        <Text style={styles.heroCopy}>
          Check announcements, track events, and manage Flex Friday without leaving the app.
        </Text>
        <View style={styles.roleRow}>
          {user?.roles?.slice(0, 3).map((role) => (
            <Pill key={role} label={role.replace(/_/g, ' ')} tone="accent" />
          ))}
        </View>
      </Card>

      <View style={styles.metricsRow}>
        <MetricCard label="Announcements" value={String(announcements.length)} tone="blue" />
        <MetricCard label="Upcoming events" value={String(upcomingEvents.length)} tone="green" />
        <MetricCard label="Unread alerts" value={String(unread?.count || 0)} tone="amber" />
      </View>

      <Card>
        <SectionTitle title="Quick Actions" />
        <View style={styles.quickActions}>
          <AppButton
            label="Schedule"
            tone="secondary"
            onPress={() => router.push('/(tabs)/schedule')}
            icon={<Clock3 size={16} color={theme.colors.textSoft} />}
            style={styles.quickButton}
          />
          <AppButton
            label="Events"
            tone="secondary"
            onPress={() => router.push('/events')}
            icon={<CalendarDays size={16} color={theme.colors.textSoft} />}
            style={styles.quickButton}
          />
          <AppButton
            label="Announcements"
            tone="secondary"
            onPress={() => router.push('/(tabs)/announcements')}
            icon={<Megaphone size={16} color={theme.colors.textSoft} />}
            style={styles.quickButton}
          />
          <AppButton
            label="Flex Friday"
            tone="secondary"
            onPress={() => router.push('/(tabs)/flex')}
            icon={<Zap size={16} color={theme.colors.textSoft} />}
            style={styles.quickButton}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="Recent Announcements"
          action={
            <Pressable onPress={() => router.push('/(tabs)/announcements')}>
              <Text style={styles.linkText}>See all</Text>
            </Pressable>
          }
        />
        <View style={styles.listBlock}>
          {latestAnnouncements.length === 0 ? (
            <Text style={styles.emptyText}>No announcements yet.</Text>
          ) : (
            latestAnnouncements.map((announcement) => (
              <Pressable
                key={announcement.id}
                onPress={() => router.push(`/announcements/${announcement.id}`)}
                style={({ pressed }) => [styles.itemCard, pressed && styles.itemCardPressed]}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemPills}>
                    {announcement.isAdminGeneral ? <Pill label="Admin" tone="red" /> : null}
                    <Pill label={announcement.targetType.replace(/_/g, ' ')} tone="blue" />
                  </View>
                  <ChevronRight size={16} color={theme.colors.textFaint} />
                </View>
                <Text style={styles.itemTitle}>{announcement.title}</Text>
                <Text style={styles.itemMeta}>
                  {announcement.author?.firstName} {announcement.author?.lastName} ·{' '}
                  {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="Upcoming Events"
          action={
            <Pressable onPress={() => router.push('/events')}>
              <Text style={styles.linkText}>Open</Text>
            </Pressable>
          }
        />
        <View style={styles.listBlock}>
          {upcomingEvents.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming events.</Text>
          ) : (
            upcomingEvents.map((event) => (
              <View key={event.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Pill label={event.club?.name || 'General'} tone={event.club ? 'green' : 'neutral'} />
                </View>
                <Text style={styles.itemTitle}>{event.title}</Text>
                <Text style={styles.itemMeta}>{formatDateTimeRange(event.startAt, event.endAt)}</Text>
                {event.location ? <Text style={styles.itemMeta}>{event.location}</Text> : null}
              </View>
            ))
          )}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Next Flex Friday" />
        {nextFriday ? (
          <View style={styles.nextFriday}>
            <View style={styles.nextFridayText}>
              <Text style={styles.itemTitle}>{format(new Date(nextFriday.date), 'EEEE, MMM d')}</Text>
              <Text style={styles.itemMeta}>{nextFriday.type.replace(/_/g, ' ')}</Text>
              {nextFriday.notes ? <Text style={styles.itemMeta}>{nextFriday.notes}</Text> : null}
            </View>
            <AppButton label="View" onPress={() => router.push('/(tabs)/flex')} style={styles.viewButton} />
          </View>
        ) : (
          <Text style={styles.emptyText}>No Flex Friday is currently scheduled.</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipPressed: {
    transform: [{ scale: 0.96 }],
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  heroCard: {
    gap: 10,
  },
  heroBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  heroCopy: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActions: {
    gap: 10,
  },
  quickButton: {
    width: '100%',
  },
  linkText: {
    color: theme.colors.accentDark,
    fontSize: 13,
    fontWeight: '700',
  },
  listBlock: {
    gap: 10,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 14,
    gap: 6,
  },
  itemCardPressed: {
    opacity: 0.85,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemPills: {
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
  nextFriday: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  nextFridayText: {
    flex: 1,
    gap: 4,
  },
  viewButton: {
    minWidth: 84,
  },
});
