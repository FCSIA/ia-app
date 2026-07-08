import { useState } from "react";
import { RefreshControl } from "react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/ui";
import { EventsView } from "@/features/calendar/EventsView";
import { MonthView } from "@/features/calendar/MonthView";
import { MyWeekView } from "@/features/calendar/MyWeekView";
import { useTheme } from "@/lib/theme";

type CalendarSegment = "week" | "month" | "events";

export default function CalendarScreen() {
  const [segment, setSegment] = useState<CalendarSegment>("week");
  const [refreshing, setRefreshing] = useState(false);
  const { color } = useTheme();

  return (
    <Screen
      header={<AppHeader title="Calendar" subtitle="Classes, month view, and events." />}
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
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        segments={[
          { label: "My Week", value: "week" },
          { label: "Month", value: "month" },
          { label: "Events", value: "events" },
        ]}
      />
      {segment === "week" ? <MyWeekView /> : segment === "month" ? <MonthView /> : <EventsView />}
    </Screen>
  );
}
