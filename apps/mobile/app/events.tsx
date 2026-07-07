import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { shortDate, timeRange } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function EventsScreen() {
  const events = useQuery(api.events.events.list, {});
  const now = Date.now();
  const calendarEntries = useQuery(api.events.calendar.list, {
    startDate: now - 7 * 24 * 60 * 60 * 1000,
    endDate: now + 45 * 24 * 60 * 60 * 1000
  });
  const { color } = useTheme();
  return (
    <Screen title="Events" subtitle="Agenda-first event browsing for mobile.">
      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Calendar</Text>
        {(calendarEntries ?? []).slice(0, 6).map((entry: any) => (
          <View key={entry._id} style={{ gap: 2 }}>
            <Text style={{ color: color("foreground"), fontWeight: "800" }}>{entry.title}</Text>
            <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
              {shortDate(entry.startAt)} · {timeRange(entry.startAt, entry.endAt)} · {entry.source}
            </Text>
          </View>
        ))}
        {calendarEntries?.length === 0 ? (
          <Text style={{ color: color("mutedForeground") }}>No calendar entries in the next few weeks.</Text>
        ) : null}
      </Card>
      <DataBoundary data={events} emptyTitle="No events">
        {(items) => (
          <View style={{ gap: 12 }}>
            {items.map((event: any) => (
              <Card key={event._id} style={{ gap: 8 }}>
                <Badge label={event.type ?? "Event"} color={event.club ? "emerald" : "blue"} />
                <Text style={{ color: color("foreground"), fontSize: 19, fontWeight: "900" }}>{event.title}</Text>
                {event.description ? (
                  <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>{event.description}</Text>
                ) : null}
                <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                  {shortDate(event.startAt)} · {timeRange(event.startAt, event.endAt)}
                  {event.location ? ` · ${event.location}` : ""}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
