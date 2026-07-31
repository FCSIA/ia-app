import { useState } from "react";
import { RefreshControl } from "react-native";
import { AppHeader } from "@/components/app-header";
import { FeedScreen } from "@/components/screen";
import { Stack } from "@/components/ui/layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EventsView } from "@/features/calendar/EventsView";
import { MonthView } from "@/features/calendar/MonthView";
import { MyWeekView } from "@/features/calendar/MyWeekView";
import { getAppPersona, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

type CalendarSegment = "week" | "month" | "events";
type NonStudentCalendarSegment = Exclude<CalendarSegment, "week">;

export default function CalendarScreen() {
  const user = useLiveCurrentUser();
  const isStudent = getAppPersona(user) === "student";
  const [studentSegment, setStudentSegment] = useState<CalendarSegment>("week");
  const [nonStudentSegment, setNonStudentSegment] =
    useState<NonStudentCalendarSegment>("month");
  const [refreshing, setRefreshing] = useState(false);
  const { color } = useTheme();
  const segment = isStudent ? studentSegment : nonStudentSegment;

  return (
    <FeedScreen
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
      <Stack gap="sm">
        <SegmentedControl
          density="compact"
          value={segment}
          onChange={(value) => {
            if (isStudent) setStudentSegment(value as CalendarSegment);
            else setNonStudentSegment(value as NonStudentCalendarSegment);
          }}
          segments={
            isStudent
              ? [
                  { label: "Schedule", value: "week" },
                  { label: "Month", value: "month" },
                  { label: "Events", value: "events" },
                ]
              : [
                  { label: "Month", value: "month" },
                  { label: "Events", value: "events" },
                ]
          }
        />
        {isStudent && segment === "week" ? (
          <MyWeekView />
        ) : segment === "month" ? (
          <MonthView />
        ) : (
          <EventsView />
        )}
      </Stack>
    </FeedScreen>
  );
}
