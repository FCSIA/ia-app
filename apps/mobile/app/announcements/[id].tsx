import { displayName } from '~/apps/shared/user-name';
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Bookmark, BookmarkCheck, Mail, MailOpen, Pin, SendHorizontal } from "lucide-react-native";
import { useMutation, useQuery } from "@/lib/convex-react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Avatar, TextField, Txt, useToast } from "@/components/ui";
import { DeveloperBadge } from "@/components/ui/developer-badge";
import { AnnouncementIconAction, announcementAudience } from "@/features/announcements/ui";
import { relativeTime } from "@/lib/format";
import { success } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import { useAnnouncementFeedClock } from "@/features/announcements/use-announcement-feed-clock";

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const announcementNow = useAnnouncementFeedClock(3_600_000);
  const detail = useQuery(api.announcements.feed.get, id ? { announcementId: id as any, now: announcementNow } : "skip");
  const markRead = useMutation(api.announcements.engagement.markRead);
  const markUnread = useMutation(api.announcements.engagement.markUnread);
  const bookmark = useMutation(api.announcements.engagement.bookmark);
  const unbookmark = useMutation(api.announcements.engagement.unbookmark);
  const addComment = useMutation(api.announcements.comments.add);
  const [comment, setComment] = useState("");
  const { color } = useTheme();
  const { showToast } = useToast();

  useEffect(() => {
    if (id && detail?.announcement && !detail.announcement.isRead) {
      markRead({ announcementId: id as any }).catch(() => {});
    }
  }, [id, detail?.announcement?.isRead, markRead]);

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
          const authorName = displayName(announcement.author);

          return (
            <View style={{ gap: spacing["2xl"] }}>
              <View style={{ gap: spacing.lg }}>
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
                  <Txt
                    variant="overline"
                    tone={announcement.isRead ? "muted" : "default"}
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {announcementAudience(announcement)}
                  </Txt>
                  {announcement.isPinned ? (
                    <View accessible accessibilityLabel="Pinned announcement">
                      <Pin size={13} color={color("mutedForeground")} />
                    </View>
                  ) : null}
                  <View style={{ marginLeft: "auto", marginRight: -spacing.sm, flexDirection: "row" }}>
                    <AnnouncementIconAction
                      icon={announcement.isRead ? Mail : MailOpen}
                      label={announcement.isRead ? "Mark unread" : "Mark read"}
                      selected={announcement.isRead}
                      onPress={() => void toggleRead(announcement.isRead)}
                    />
                    <AnnouncementIconAction
                      icon={announcement.isBookmarked ? BookmarkCheck : Bookmark}
                      label={announcement.isBookmarked ? "Unsave announcement" : "Save announcement"}
                      selected={announcement.isBookmarked}
                      accentWhenSelected
                      onPress={() => void toggleBookmark(announcement.isBookmarked)}
                    />
                  </View>
                </View>

                <View style={{ gap: spacing.sm }}>
                  <Txt variant="display">{announcement.title}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Txt variant="caption" tone="muted">
                      {authorName || "Innovation Academy"}
                    </Txt>
                    <DeveloperBadge user={announcement.author} size={12} />
                    <Txt variant="caption" tone="muted">
                      {" "}· {relativeTime(announcement.createdAt)}
                    </Txt>
                  </View>
                </View>

                <Txt style={{ lineHeight: 25 }}>{announcement.body}</Txt>
              </View>

              {announcement.allowComments ? (
                <View style={{ gap: spacing.lg }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                    <Txt variant="section">Comments</Txt>
                    {data.comments.length ? (
                      <Txt variant="caption" tone="muted">{data.comments.length}</Txt>
                    ) : null}
                  </View>
                  {data.comments.length ? (
                    <View style={{ gap: spacing.xl }}>
                      {data.comments.map((row: any) => {
                        const commentAuthor = displayName(row.author);
                        return (
                          <View
                            key={row._id}
                            style={{
                              flexDirection: "row",
                              alignItems: "flex-start",
                              gap: spacing.md,
                            }}
                          >
                            <Avatar
                              uri={row.author?.avatarUrl}
                              name={commentAuthor || "Community member"}
                              size={36}
                            />
                            <View style={{ flex: 1, gap: spacing.xs }}>
                              <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                                <Txt variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                                  {commentAuthor || "Community member"}
                                </Txt>
                                <DeveloperBadge user={row.author} size={12} />
                                <Txt variant="caption" tone="muted">{relativeTime(row.createdAt)}</Txt>
                              </View>
                              <Txt>{row.body}</Txt>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Txt tone="muted">No comments yet.</Txt>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
                    <TextField
                      placeholder="Write a comment…"
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      style={{ flex: 1, maxHeight: 128 }}
                    />
                    <AnnouncementIconAction
                      icon={SendHorizontal}
                      label="Post comment"
                      disabled={!comment.trim()}
                      tone="primary"
                      onPress={() => void submitComment()}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}
