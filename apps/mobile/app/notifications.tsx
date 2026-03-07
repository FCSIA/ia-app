import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { notificationsApi } from '@/lib/api';
import { Card, EmptyState, Pill, Screen } from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';
import type { NotificationRecord } from '@/types/api';
import { theme } from '@/theme';

const categoryTones: Record<string, 'blue' | 'green' | 'amber' | 'neutral'> = {
  SCHOOL_ANNOUNCEMENT: 'blue',
  CLUB_ANNOUNCEMENT: 'green',
  EVENT: 'amber',
  FLEX_FRIDAY: 'neutral',
  CLUB_CHANNEL_MENTION: 'amber',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<NotificationRecord[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll().then((response) => response.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead([id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: () => {
      Alert.alert('Could not update notifications');
    },
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  function openNotification(notification: NotificationRecord) {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }

    if (notification.channelId && notification.clubId) {
      router.push(`/clubs/${notification.clubId}/channels/${notification.channelId}`);
      return;
    }

    if (notification.announcementId) {
      router.push(`/announcements/${notification.announcementId}`);
      return;
    }

    if (notification.eventId) {
      router.push('/events');
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color={theme.colors.textSoft} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Recent alerts and activity updates.</Text>
        </View>
      </View>

      {unreadCount > 0 ? (
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
          <Text style={styles.summaryText}>
            Mark everything as read once you have handled the latest announcements and events.
          </Text>
          <Pressable onPress={() => markAllMutation.mutate()} style={styles.markAllButton}>
            <Text style={styles.markAllText}>{markAllMutation.isPending ? 'Updating...' : 'Mark all as read'}</Text>
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.list}>
        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing new right now"
            description="Notifications for announcements, events, and Flex Friday will show up here."
          />
        ) : (
          notifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => openNotification(notification)}
              style={({ pressed }) => [
                styles.notificationCard,
                !notification.isRead && styles.notificationCardUnread,
                pressed && styles.notificationCardPressed,
              ]}
            >
              <View style={styles.notificationHeader}>
                <View style={styles.headerLeft}>
                  <View
                    style={[
                      styles.unreadDot,
                      { opacity: notification.isRead ? 0.25 : 1 },
                    ]}
                  />
                  <Pill
                    label={notification.category.replace(/_/g, ' ')}
                    tone={categoryTones[notification.category] || 'neutral'}
                  />
                </View>
                <Text style={styles.notificationTime}>
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </Text>
              </View>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              {notification.body ? (
                <Text style={styles.notificationBody}>{notification.body}</Text>
              ) : null}
            </Pressable>
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
  },
  summaryCard: {
    gap: 8,
  },
  summaryTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  summaryText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  markAllButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  markAllText: {
    color: theme.colors.accentDark,
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  notificationCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
    gap: 8,
    ...theme.shadow.card,
  },
  notificationCardUnread: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: 'rgba(249, 115, 22, 0.16)',
  },
  notificationCardPressed: {
    opacity: 0.88,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
    marginLeft: 2,
  },
  notificationTime: {
    color: theme.colors.textFaint,
    fontSize: 11,
  },
  notificationTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  notificationBody: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
