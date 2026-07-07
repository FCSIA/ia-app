import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import { useTheme } from "@/lib/theme";

const colors: Record<string, React.ComponentProps<typeof Badge>["color"]> = {
  SCHOOL_WIDE: "blue",
  GRADE: "violet",
  PATHWAY: "emerald",
  CLUB: "amber"
};

export function AnnouncementCard({ announcement }: { announcement: any }) {
  const { color } = useTheme();
  const authorName = [announcement.author?.firstName, announcement.author?.lastName].filter(Boolean).join(" ");

  return (
    <Pressable onPress={() => router.push(`/announcements/${announcement._id}`)}>
      <Card style={{ gap: 12, borderColor: announcement.isRead ? color("border") : color("foreground") }}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {!announcement.isRead ? <Badge label="Unread" color="cyan" variant="dot" /> : null}
          {announcement.isPinned ? <Badge label="Pinned" color="amber" /> : null}
          <Badge
            label={(announcement.targetType ?? "School").replaceAll("_", " ")}
            color={colors[announcement.targetType] ?? "gray"}
          />
        </View>
        <Text style={{ color: color("foreground"), fontSize: 17, fontWeight: "800" }} numberOfLines={2}>
          {announcement.title}
        </Text>
        <Text style={{ color: color("mutedForeground"), lineHeight: 21 }} numberOfLines={3}>
          {announcement.body}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
            {authorName || "Innovation Academy"} · {relativeTime(announcement.createdAt)}
          </Text>
          {announcement.allowComments ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MessageCircle size={14} color={color("mutedForeground")} />
              <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                {announcement._count?.comments ?? 0}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
