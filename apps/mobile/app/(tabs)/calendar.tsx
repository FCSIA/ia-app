import { hasAnyRole, STUDENT_ROLES } from "~/apps/shared/roles";
import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from "react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/ui";
import { EventsView } from "@/features/calendar/EventsView";
import { MonthView } from "@/features/calendar/MonthView";
import { MyWeekView } from "@/features/calendar/MyWeekView";
import { useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

type CalendarSegment = "week" | "month" | "events";
type NonStudentCalendarSegment = Exclude<CalendarSegment, "week">;

export default function CalendarScreen() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const user = useLiveCurrentUser();
  const isStudent = hasAnyRole(user, STUDENT_ROLES);
  const [studentSegment, setStudentSegment] = useState<CalendarSegment>("week");
  const [nonStudentSegment, setNonStudentSegment] =
    useState<NonStudentCalendarSegment>("month");
  const [refreshing, setRefreshing] = useState(false);
  const { color } = useTheme();
  const segment = isStudent ? studentSegment : nonStudentSegment;
  useEffect(() => {
    if (view === 'schedule' && isStudent) {
      setStudentSegment('week');
      router.setParams({ view: undefined });
    }
  }, [view, isStudent]);

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
          onChange={(value) => {
            if (isStudent) setStudentSegment(value as CalendarSegment);
            else setNonStudentSegment(value as NonStudentCalendarSegment);
          }}
          segments={isStudent
            ? [
                { label: "Schedule", value: "week" },
                { label: "Month", value: "month" },
                { label: "Events", value: "events" },
              ]
            : [
                { label: "Month", value: "month" },
                { label: "Events", value: "events" },
              ]}
        />
        {isStudent && segment === "week" ? (
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
