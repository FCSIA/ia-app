import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { relativeTime } from "@/lib/format";
import { useTheme } from "@/lib/theme";
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

  async function submitComment() {
    if (!comment.trim() || !id) return;
    try {
      await addComment({ announcementId: id as any, body: comment });
      setComment("");
    } catch (error) {
      Alert.alert("Comment not posted", error instanceof Error ? error.message : "Try again.");
    }
  }

  return (
    <Screen>
      <DataBoundary data={detail} emptyTitle="Announcement unavailable">
        {(data) => (
          <>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={data.announcement.targetType.replaceAll("_", " ")} color="blue" />
                {!data.announcement.isRead ? <Badge label="Unread" color="cyan" variant="dot" /> : null}
              </View>
              <Text style={{ color: color("foreground"), fontSize: 26, fontWeight: "900" }}>
                {data.announcement.title}
              </Text>
              <Text style={{ color: color("mutedForeground"), lineHeight: 22 }}>{data.announcement.body}</Text>
              <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                {relativeTime(data.announcement.createdAt)}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  title={data.announcement.isRead ? "Mark unread" : "Mark read"}
                  variant="secondary"
                  onPress={() =>
                    data.announcement.isRead
                      ? markUnread({ announcementId: id as any })
                      : markRead({ announcementId: id as any })
                  }
                />
                <Button
                  title={data.announcement.isBookmarked ? "Unsave" : "Save"}
                  variant="tertiary"
                  onPress={() =>
                    data.announcement.isBookmarked
                      ? unbookmark({ announcementId: id as any })
                      : bookmark({ announcementId: id as any })
                  }
                />
              </View>
            </Card>

            {data.announcement.allowComments ? (
              <Card style={{ gap: 12 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Comments</Text>
                {data.comments.map((row: any) => (
                  <View key={row._id} style={{ gap: 2 }}>
                    <Text style={{ color: color("foreground"), fontWeight: "800" }}>
                      {[row.author?.firstName, row.author?.lastName].filter(Boolean).join(" ") || "Student"}
                    </Text>
                    <Text style={{ color: color("mutedForeground") }}>{row.body}</Text>
                  </View>
                ))}
                <TextField placeholder="Add a comment" value={comment} onChangeText={setComment} />
                <Button title="Post comment" onPress={submitComment} disabled={!comment.trim()} />
              </Card>
            ) : null}
          </>
        )}
      </DataBoundary>
    </Screen>
  );
}
