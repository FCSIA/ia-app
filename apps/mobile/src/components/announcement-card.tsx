import { displayName } from '~/apps/shared/user-name';
import { View } from "react-native";
import { router } from "expo-router";
import { Bookmark, BookmarkCheck, Mail, MailOpen, MessageCircle, Pin } from "lucide-react-native";
import { PressableScale, Txt } from "@/components/ui";
import { DeveloperBadge } from "@/components/ui/developer-badge";
import { announcementAudience } from "@/features/announcements/model";
import { AnnouncementIconAction } from "@/features/announcements/ui";
import { useAnnouncementActions } from "@/features/announcements/use-announcement-actions";
import { announcementUnreadColors } from "@/features/announcements/unread-colors";
import { relativeTime } from "@/lib/format";
import { radii, spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";

export function AnnouncementCard({ announcement }: { announcement: any }) {
  const { color, name: themeName, tokens } = useTheme();
  const { toggleRead, toggleBookmark } = useAnnouncementActions();
  const authorName = displayName(announcement.author);
  const audience = announcementAudience(announcement);
  const unreadColors = announcementUnreadColors(tokens);
  const isUnread = !announcement.isRead;
  const foreground = isUnread ? unreadColors.foreground : undefined;
  const mutedForeground = isUnread ? unreadColors.mutedForeground : undefined;

  return (
    <View
      style={{
        borderRadius: radii.md,
        borderWidth: themeName === "high-contrast" ? 1 : 0,
        borderColor: color("border"),
        backgroundColor: announcement.isRead ? "transparent" : unreadColors.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
      }}
    >
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${announcement.isRead ? "" : "Unread: "}${announcement.title}`}
        onPress={() => router.push(`/announcements/${announcement._id}`)}
        style={{ flex: 1 }}
      >
        <View style={{ gap: spacing.xs }}>
          <View style={{ minHeight: 20, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {!announcement.isRead ? (
              <View
                accessible
                accessibilityLabel="Unread"
                style={{
                  width: spacing.sm,
                  height: spacing.sm,
                  borderRadius: radii.pill,
                  backgroundColor: unreadColors.icon,
                }}
              />
            ) : null}
            <Txt
              variant="overline"
              tone={announcement.isRead ? "muted" : "default"}
              numberOfLines={1}
              style={[{ flexShrink: 1 }, foreground ? { color: foreground } : undefined]}
            >
              {audience}
            </Txt>
            {announcement.isPinned ? (
              <View accessible accessibilityLabel="Pinned announcement">
                <Pin size={13} color={mutedForeground ?? color("mutedForeground")} />
              </View>
            ) : null}
          </View>

          <Txt
            variant="section"
            numberOfLines={2}
            style={[{ fontWeight: announcement.isRead ? "700" : "800" }, foreground ? { color: foreground } : undefined]}
          >
            {announcement.title}
          </Txt>
          <Txt tone="muted" numberOfLines={2} style={mutedForeground ? { color: mutedForeground } : undefined}>
            {announcement.body}
          </Txt>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs }}>
            <Txt
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={[{ flexShrink: 1 }, mutedForeground ? { color: mutedForeground } : undefined]}
            >
              {authorName || "Innovation Academy"}
            </Txt>
            <DeveloperBadge user={announcement.author} size={12} />
            <Txt variant="caption" tone="muted" style={mutedForeground ? { color: mutedForeground } : undefined}>·</Txt>
            <Txt variant="caption" tone="muted" style={mutedForeground ? { color: mutedForeground } : undefined}>
              {relativeTime(announcement.createdAt)}
            </Txt>
            {announcement.allowComments ? (
              <View
                accessible
                accessibilityLabel={`${announcement.commentCount ?? 0} comments`}
                style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: spacing.xs }}
              >
                <MessageCircle size={13} color={mutedForeground ?? color("mutedForeground")} />
                <Txt variant="caption" tone="muted" style={mutedForeground ? { color: mutedForeground } : undefined}>
                  {announcement.commentCount ?? 0}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>

      <View style={{ flexDirection: "row", marginRight: -spacing.sm, marginTop: -spacing.sm }}>
        <AnnouncementIconAction
          icon={announcement.isRead ? Mail : MailOpen}
          label={announcement.isRead ? "Mark unread" : "Mark read"}
          selected={announcement.isRead}
          iconColor={isUnread ? unreadColors.mutedForeground : undefined}
          onPress={() => void toggleRead(announcement._id, announcement.isRead)}
        />
        <AnnouncementIconAction
          icon={announcement.isBookmarked ? BookmarkCheck : Bookmark}
          label={announcement.isBookmarked ? "Unsave announcement" : "Save announcement"}
          selected={announcement.isBookmarked}
          accentWhenSelected
          iconColor={isUnread ? unreadColors.icon : undefined}
          onPress={() => void toggleBookmark(announcement._id, announcement.isBookmarked)}
        />
      </View>
    </View>
  );
}
