import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/ui";
import { EventsView } from "@/features/calendar/EventsView";
import { MonthView } from "@/features/calendar/MonthView";
import { MyWeekView } from "@/features/calendar/MyWeekView";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

type CalendarSegment = "week" | "month" | "events";

export default function CalendarScreen() {
  const [segment, setSegment] = useState<CalendarSegment>("week");
  const [refreshing, setRefreshing] = useState(false);
  const { color } = useTheme();

  return (
    <Screen
      header={<AppHeader title="Calendar" />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color("primary")}
          onRefresh={() => {
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 550);
          }}
        />
      }
    >
      <View
        style={{
          width: "100%",
          maxWidth: spacing.xl * 32,
          alignSelf: "center",
          gap: spacing.xl,
        }}
      >
        <SegmentedControl
          value={segment}
          onChange={setSegment}
          segments={[
            { label: "My Week", value: "week" },
            { label: "Month", value: "month" },
            { label: "Events", value: "events" },
          ]}
        />
        {segment === "week" ? (
          <MyWeekView />
        ) : segment === "month" ? (
          <MonthView />
        ) : (
          <EventsView />
        )}
      </View>
    </Screen>
  );
}
