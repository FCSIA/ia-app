import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { shortDate, timeRange } from "@/lib/format";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function DashboardScreen() {
  const user = useCurrentUser();
  const announcements = useQuery(api.announcements.feed.list, { unreadOnly: true });
  const schedule = useQuery(api.schedule.dashboard.get, {});
  const events = useQuery(api.events.events.list, {});
  const { color } = useTheme();

  return (
    <Screen title={`Hi, ${user?.firstName ?? "there"}`} subtitle="Your school day at a glance.">
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Today</Text>
          <Badge label={user?.roles?.[0] ?? "Student"} color="orange" />
        </View>
        <DataBoundary data={schedule} emptyTitle="No schedule yet">
          {(data) => (
            <View style={{ gap: 8 }}>
              {(data.mySchedule?.entries ?? []).slice(0, 4).map((entry: any) => (
                <View key={entry.id ?? `${entry.weekday}-${entry.periodNumber}`} style={{ gap: 2 }}>
                  <Text style={{ color: color("foreground"), fontWeight: "800" }}>
                    Period {entry.periodNumber}: {entry.className}
                  </Text>
                  <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{entry.weekday}</Text>
                </View>
              ))}
            </View>
          )}
        </DataBoundary>
      </Card>

      <View style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Unread Announcements</Text>
        <DataBoundary data={announcements} emptyTitle="All caught up">
          {(items) => <>{items.slice(0, 3).map((item: any) => <AnnouncementCard key={item._id} announcement={item} />)}</>}
        </DataBoundary>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Coming Up</Text>
        <DataBoundary data={events} emptyTitle="No upcoming events">
          {(items) => (
            <View style={{ gap: 10 }}>
              {items.slice(0, 3).map((event: any) => (
                <View key={event._id}>
                  <Text style={{ color: color("foreground"), fontWeight: "800" }}>{event.title}</Text>
                  <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                    {shortDate(event.startAt)} · {timeRange(event.startAt, event.endAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </DataBoundary>
      </Card>
    </Screen>
  );
}
