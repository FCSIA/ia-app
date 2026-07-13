import { View } from "react-native";
import { router } from "expo-router";
import { Bookmark, BookmarkCheck, Mail, MailOpen, MessageCircle, Pin } from "lucide-react-native";
import { useMutation } from "convex/react";
import { PressableScale, Txt, useToast } from "@/components/ui";
import { AnnouncementIconAction, announcementAudience } from "@/features/announcements/ui";
import { relativeTime } from "@/lib/format";
import { success } from "@/lib/haptics";
import { radii, spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export function AnnouncementCard({ announcement }: { announcement: any }) {
  const { color, name: themeName } = useTheme();
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const bookmark = useMutation(api.announcements.engagement.bookmark);
  const unbookmark = useMutation(api.announcements.engagement.unbookmark);
  const { showToast } = useToast();
  const authorName = [announcement.author?.firstName, announcement.author?.lastName].filter(Boolean).join(" ");
  const audience = announcementAudience(announcement);

  async function toggleRead() {
    try {
      const args = { announcementId: announcement._id };
      await (announcement.isRead ? markUnread(args as any) : markRead(args as any));
      await success();
      showToast({ title: announcement.isRead ? "Marked unread" : "Marked read", tone: "success" });
    } catch {
      showToast({ title: "Read status didn't change", body: "Try again.", tone: "warning" });
    }
  }

  async function toggleBookmark() {
    try {
      const args = { announcementId: announcement._id };
      await (announcement.isBookmarked ? unbookmark(args as any) : bookmark(args as any));
      await success();
      showToast({ title: announcement.isBookmarked ? "Removed from saved" : "Saved", tone: "success" });
    } catch {
      showToast({ title: "Saved status didn't change", body: "Try again.", tone: "warning" });
    }
  }

  return (
    <View
      style={{
        borderRadius: radii.md,
        borderWidth: themeName === "high-contrast" ? 1 : 0,
        borderColor: color("border"),
        backgroundColor: announcement.isRead ? "transparent" : color("secondary"),
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
        onPress={() => router.push(`/announcements/${announcement._id}` as never)}
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
                  backgroundColor: color("primary"),
                }}
              />
            ) : null}
            <Txt
              variant="overline"
              tone={announcement.isRead ? "muted" : "default"}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {audience}
            </Txt>
            {announcement.isPinned ? (
              <View accessible accessibilityLabel="Pinned announcement">
                <Pin size={13} color={color("mutedForeground")} />
              </View>
            ) : null}
          </View>

          <Txt
            variant="section"
            numberOfLines={2}
            style={{ fontWeight: announcement.isRead ? "700" : "800" }}
          >
            {announcement.title}
          </Txt>
          <Txt tone="muted" numberOfLines={2}>{announcement.body}</Txt>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs }}>
            <Txt variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {authorName || "Innovation Academy"}
            </Txt>
            <Txt variant="caption" tone="muted">·</Txt>
            <Txt variant="caption" tone="muted">
              {relativeTime(announcement.createdAt)}
            </Txt>
            {announcement.allowComments ? (
              <View
                accessible
                accessibilityLabel={`${announcement.commentCount ?? 0} comments`}
                style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: spacing.xs }}
              >
                <MessageCircle size={13} color={color("mutedForeground")} />
                <Txt variant="caption" tone="muted">{announcement.commentCount ?? 0}</Txt>
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
          onPress={() => void toggleRead()}
        />
        <AnnouncementIconAction
          icon={announcement.isBookmarked ? BookmarkCheck : Bookmark}
          label={announcement.isBookmarked ? "Unsave announcement" : "Save announcement"}
          selected={announcement.isBookmarked}
          accentWhenSelected
          onPress={() => void toggleBookmark()}
        />
      </View>
    </View>
  );
}
