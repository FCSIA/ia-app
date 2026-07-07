import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export default function ScheduleScreen() {
  const data = useQuery(api.schedule.dashboard.get, {});
  const { color } = useTheme();

  return (
    <Screen title="Schedule" subtitle="Your classes and shared friend schedule access.">
      <DataBoundary data={data} emptyTitle="Schedule unavailable">
        {(schedule) => (
          <View style={{ gap: 14 }}>
            {weekdays.map((day) => {
              const entries = (schedule.mySchedule?.entries ?? []).filter((entry: any) => entry.weekday === day);
              return (
                <Card key={day} style={{ gap: 10 }}>
                  <Badge label={day.replace("_", " ")} color="blue" />
                  {entries.length === 0 ? (
                    <Text style={{ color: color("mutedForeground") }}>No classes saved.</Text>
                  ) : (
                    entries.map((entry: any) => (
                      <View key={entry.id ?? `${day}-${entry.periodNumber}`} style={{ gap: 2 }}>
                        <Text style={{ color: color("foreground"), fontWeight: "900" }}>Period {entry.periodNumber}</Text>
                        <Text style={{ color: color("mutedForeground") }}>{entry.className}</Text>
                      </View>
                    ))
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
