import { View } from "react-native";
import { router } from "expo-router";
import { Bookmark, BookmarkCheck, CheckCircle2, MessageCircle } from "lucide-react-native";
import { useMutation } from "convex/react";
import { Badge, Card, IconButton, PressableScale, Txt, useToast } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { success } from "@/lib/haptics";
import { spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

const colors: Record<string, React.ComponentProps<typeof Badge>["color"]> = {
  SCHOOL_WIDE: "blue",
  GRADE: "violet",
  PATHWAY: "emerald",
  CLUB: "amber",
};

export function AnnouncementCard({ announcement }: { announcement: any }) {
  const { color } = useTheme();
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const bookmark = useMutation(api.announcements.engagement.bookmark);
  const unbookmark = useMutation(api.announcements.engagement.unbookmark);
  const { showToast } = useToast();
  const authorName = [announcement.author?.firstName, announcement.author?.lastName].filter(Boolean).join(" ");

  async function toggleRead() {
    const args = { announcementId: announcement._id };
    await (announcement.isRead ? markUnread(args as any) : markRead(args as any));
    await success();
    showToast({ title: announcement.isRead ? "Marked unread" : "Marked read", tone: "success" });
  }

  async function toggleBookmark() {
    const args = { announcementId: announcement._id };
    await (announcement.isBookmarked ? unbookmark(args as any) : bookmark(args as any));
    await success();
    showToast({ title: announcement.isBookmarked ? "Removed from saved" : "Saved", tone: "success" });
  }

  return (
    <PressableScale onPress={() => router.push(`/announcements/${announcement._id}` as never)}>
      <Card style={{ gap: spacing.md, borderColor: announcement.isRead ? color("border") : color("foreground") }}>
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
          {!announcement.isRead ? <Badge label="Unread" color="cyan" variant="dot" /> : null}
          {announcement.isPinned ? <Badge label="Pinned" color="amber" /> : null}
          {announcement.isBookmarked ? <Badge label="Saved" color="emerald" variant="dot" /> : null}
          <Badge
            label={(announcement.targetType ?? "School").replaceAll("_", " ")}
            color={colors[announcement.targetType] ?? "gray"}
          />
        </View>
        <Txt variant="section" numberOfLines={2}>{announcement.title}</Txt>
        <Txt tone="muted" numberOfLines={3}>{announcement.body}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Txt variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {authorName || "Innovation Academy"} - {relativeTime(announcement.createdAt)}
          </Txt>
          {announcement.allowComments ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MessageCircle size={14} color={color("mutedForeground")} />
              <Txt variant="caption" tone="muted">{announcement._count?.comments ?? 0}</Txt>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <IconButton
            icon={CheckCircle2}
            label={announcement.isRead ? "Mark unread" : "Mark read"}
            onPress={(event) => {
              event?.stopPropagation();
              void toggleRead();
            }}
          />
          <IconButton
            icon={announcement.isBookmarked ? BookmarkCheck : Bookmark}
            label={announcement.isBookmarked ? "Unsave announcement" : "Save announcement"}
            onPress={(event) => {
              event?.stopPropagation();
              void toggleBookmark();
            }}
          />
        </View>
      </Card>
    </PressableScale>
  );
}
