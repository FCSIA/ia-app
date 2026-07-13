import { View } from "react-native";
import { router } from "expo-router";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, MessageCircle, Pin } from "lucide-react-native";
import { useMutation } from "convex/react";
import { IconButton, PressableScale, Txt, useToast } from "@/components/ui";
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
    <PressableScale
      accessibilityLabel={`${announcement.isRead ? "" : "Unread: "}${announcement.title}`}
      onPress={() => router.push(`/announcements/${announcement._id}` as never)}
    >
      <View
        style={{
          borderRadius: radii.lg,
          borderWidth: themeName === "high-contrast" ? 1 : 0,
          borderColor: color("border"),
          backgroundColor: announcement.isRead ? color("card") : color("secondary"),
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
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
            <View
              accessibilityLabel="Pinned announcement"
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
            >
              <Txt variant="caption" tone="muted">•</Txt>
              <Pin size={12} color={color("mutedForeground")} />
              <Txt variant="caption" tone="muted">Pinned</Txt>
            </View>
          ) : null}
          <Txt variant="caption" tone="muted" style={{ marginLeft: "auto" }}>
            {relativeTime(announcement.createdAt)}
          </Txt>
        </View>

        <Txt
          variant="section"
          numberOfLines={2}
          style={{ fontWeight: announcement.isRead ? "700" : "800" }}
        >
          {announcement.title}
        </Txt>
        <Txt tone="muted" numberOfLines={2}>{announcement.body}</Txt>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Txt variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {authorName || "Innovation Academy"}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {announcement.allowComments ? (
              <View
                accessibilityLabel={`${announcement.commentCount ?? 0} comments`}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
              >
                <MessageCircle size={14} color={color("mutedForeground")} />
                <Txt variant="caption" tone="muted">{announcement.commentCount ?? 0}</Txt>
              </View>
            ) : null}
            <IconButton
              icon={announcement.isRead ? Circle : CheckCircle2}
              label={announcement.isRead ? "Mark unread" : "Mark read"}
              size="sm"
              variant="ghost"
              onPress={(event) => {
                event?.stopPropagation();
                void toggleRead();
              }}
            />
            <IconButton
              icon={announcement.isBookmarked ? BookmarkCheck : Bookmark}
              label={announcement.isBookmarked ? "Unsave announcement" : "Save announcement"}
              size="sm"
              variant="ghost"
              onPress={(event) => {
                event?.stopPropagation();
                void toggleBookmark();
              }}
            />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function announcementAudience(announcement: any) {
  if (announcement.club?.name) return announcement.club.name;
  if (announcement.targetType === "GRADE") {
    const grades = Array.from(
      new Set([announcement.targetGrade, ...(announcement.targetGrades ?? [])].filter(Boolean)),
    );
    if (grades.length === 1) return `Grade ${grades[0]}`;
    if (grades.length > 1) return `Grades ${grades.join(", ")}`;
    return "Grade";
  }
  if (announcement.targetType === "PATHWAY") return "Pathway";
  if (announcement.targetType === "CLUB") return "Club";
  if (announcement.targetType === "INTERSECTION") return "Student group";
  return "School";
}
