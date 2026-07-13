import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle, Pin } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Button, Section, TextField, Txt, useToast } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { success } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery(api.announcements.feed.get, id ? { announcementId: id as any } : "skip");
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const bookmark = useMutation(api.announcements.engagement.bookmark);
  const unbookmark = useMutation(api.announcements.engagement.unbookmark);
  const addComment = useMutation(api.announcements.comments.add);
  const [comment, setComment] = useState("");
  const { color } = useTheme();
  const { showToast } = useToast();

  async function submitComment() {
    if (!comment.trim() || !id) return;
    try {
      await addComment({ announcementId: id as any, body: comment.trim() });
      setComment("");
      await success();
      showToast({ title: "Comment posted", tone: "success" });
    } catch (error) {
      showToast({
        title: "Comment wasn't posted",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    }
  }

  async function toggleRead(isRead: boolean) {
    if (!id) return;
    try {
      await (isRead ? markUnread({ announcementId: id as any }) : markRead({ announcementId: id as any }));
      await success();
      showToast({ title: isRead ? "Marked unread" : "Marked read", tone: "success" });
    } catch {
      showToast({ title: "Read status didn't change", body: "Try again.", tone: "warning" });
    }
  }

  async function toggleBookmark(isBookmarked: boolean) {
    if (!id) return;
    try {
      await (isBookmarked
        ? unbookmark({ announcementId: id as any })
        : bookmark({ announcementId: id as any }));
      await success();
      showToast({ title: isBookmarked ? "Removed from saved" : "Saved", tone: "success" });
    } catch {
      showToast({ title: "Saved status didn't change", body: "Try again.", tone: "warning" });
    }
  }

  return (
    <Screen>
      <DataBoundary data={detail} emptyTitle="Announcement unavailable">
        {(data) => {
          const announcement = data.announcement;
          const authorName = [announcement.author?.firstName, announcement.author?.lastName]
            .filter(Boolean)
            .join(" ");

          return (
            <View style={{ gap: spacing.xl }}>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  {!announcement.isRead ? (
                    <View
                      accessible
                      accessibilityLabel="Unread"
                      style={{
                        width: spacing.sm,
                        height: spacing.sm,
                        borderRadius: spacing.sm,
                        backgroundColor: color("primary"),
                      }}
                    />
                  ) : null}
                  <Txt variant="overline" tone="muted">
                    {announcementAudience(announcement)}
                  </Txt>
                  {announcement.isPinned ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                      <Txt variant="caption" tone="muted">•</Txt>
                      <Pin size={13} color={color("mutedForeground")} />
                      <Txt variant="caption" tone="muted">Pinned</Txt>
                    </View>
                  ) : null}
                </View>

                <Txt variant="title">{announcement.title}</Txt>
                <Txt variant="caption" tone="muted">
                  {authorName || "Innovation Academy"} · {relativeTime(announcement.createdAt)}
                </Txt>
                <Txt style={{ lineHeight: 24 }}>{announcement.body}</Txt>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: color("border"),
                    paddingVertical: spacing.sm,
                    flexDirection: "row",
                    gap: spacing.sm,
                  }}
                >
                  <Button
                    title={announcement.isRead ? "Mark unread" : "Mark read"}
                    icon={announcement.isRead ? Circle : CheckCircle2}
                    size="sm"
                    variant="secondary"
                    onPress={() => void toggleRead(announcement.isRead)}
                  />
                  <Button
                    title={announcement.isBookmarked ? "Unsave" : "Save"}
                    icon={announcement.isBookmarked ? BookmarkCheck : Bookmark}
                    size="sm"
                    variant="ghost"
                    onPress={() => void toggleBookmark(announcement.isBookmarked)}
                  />
                </View>
              </View>

              {announcement.allowComments ? (
                <Section title="Comments">
                  {data.comments.length ? (
                    data.comments.map((row: any, index: number) => {
                      const commentAuthor = [row.author?.firstName, row.author?.lastName]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <View
                          key={row._id}
                          style={{
                            gap: spacing.xs,
                            paddingTop: index ? spacing.md : 0,
                            borderTopWidth: index ? 1 : 0,
                            borderColor: color("border"),
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                            <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>
                              {commentAuthor || "Community member"}
                            </Txt>
                            <Txt variant="caption" tone="muted">{relativeTime(row.createdAt)}</Txt>
                          </View>
                          <Txt tone="muted">{row.body}</Txt>
                        </View>
                      );
                    })
                  ) : (
                    <Txt variant="caption" tone="muted">No comments yet.</Txt>
                  )}
                  <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
                    <TextField
                      placeholder="Write a comment…"
                      value={comment}
                      onChangeText={setComment}
                      multiline
                    />
                    <Button title="Post" onPress={() => void submitComment()} disabled={!comment.trim()} />
                  </View>
                </Section>
              ) : null}
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
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
