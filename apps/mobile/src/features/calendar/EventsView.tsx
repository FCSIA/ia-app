import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ChevronRight, Plus, X } from "lucide-react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@/lib/convex-react";
import { DataBoundary } from "@/components/data-boundary";
import {
  Button,
  ChipGroup,
  IconButton,
  PressableScale,
  Sheet,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { CreateEventSheet } from "./create-event-sheet";
import { useCurrentUser } from "@/lib/auth";
import { timeRange } from "@/lib/format";
import { warning } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export function EventsView() {
  const user = useCurrentUser();
  const events = useQuery(api.events.events.list, {});
  const myClubs = useQuery(api.clubs.management.getMyClubs, {});
  const createEvent = useMutation(api.events.events.create);
  const cancelEvent = useMutation(api.events.events.cancel);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { showToast } = useToast();
  const canCreateGeneral = !!user?.roles?.some((role) =>
    ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"].includes(role),
  );
  const availableClubs = useMemo(
    () =>
      [
        ...((myClubs?.memberOf ?? []).filter(
          (club: any) => club.role === "LEADER" || club.role === "SPONSOR",
        )),
        ...(myClubs?.sponsoring ?? []),
      ].filter(
        (club: any, index: number, list: any[]) =>
          list.findIndex((item) => item._id === club._id) === index,
      ),
    [myClubs],
  );
  const canCreate = canCreateGeneral || availableClubs.length > 0;
  
  const filteredEvents = useMemo(() => {
    const value = search.trim().toLowerCase();
    return (events ?? []).filter((event: any) => {
      if (!value) return true;
      return [event.title, event.description, event.location, event.club?.name, event.status]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(value));
    });
  }, [events, search]);
  
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const event of filteredEvents) {
      const key = new Date(event.startAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()];
  }, [filteredEvents]);

  function confirmCancel(event: any) {
    void warning();
    Alert.alert(`Cancel “${event.title}”?`, "It will disappear from published calendars.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel event",
        style: "destructive",
        onPress: () =>
          cancelEvent({ eventId: event._id }).catch((error) =>
            showToast({
              title: "Event not cancelled",
              body: error instanceof Error ? error.message : "Try again.",
            }),
          ),
      },
    ]);
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <TextField value={search} onChangeText={setSearch} placeholder="Search events" />
        {canCreate ? (
          <Button
            title="Create"
            size="sm"
            variant="tertiary"
            icon={Plus}
            onPress={() => setShowCreate(true)}
            style={{ alignSelf: "flex-end" }}
          />
        ) : null}
      </View>

      <DataBoundary data={events} emptyTitle="No events scheduled">
        {() =>
          groupedEvents.length ? (
            <View style={{ gap: spacing.lg }}>
              {groupedEvents.map(([date, dateEvents]) => (
                <EventDayGroup
                  key={date}
                  date={new Date(date)}
                  events={dateEvents}
                  canCancel={(event) =>
                    event.status === "PUBLISHED" &&
                    (event.authorId === user?._id || canCreateGeneral)
                  }
                  onCancel={confirmCancel}
                />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <Txt tone="muted">No matches.</Txt>
            </View>
          )
        }
      </DataBoundary>

      <CreateEventSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

function EventDayGroup({
  date,
  events,
  canCancel,
  onCancel,
}: {
  date: Date;
  events: any[];
  canCancel: (event: any) => boolean;
  onCancel: (event: any) => void;
}) {
  const { color } = useTheme();
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const calendarDate = date
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();

  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="overline" tone="muted">
        {weekday} · {calendarDate}
      </Txt>
      <View
        style={{
          overflow: "hidden",
          borderRadius: radii.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: color("border"),
          backgroundColor: color("card"),
        }}
      >
        {events.map((event, index) => (
          <EventRow
            key={event._id}
            event={event}
            last={index === events.length - 1}
            canCancel={canCancel(event)}
            onCancel={() => onCancel(event)}
          />
        ))}
      </View>
    </View>
  );
}

function EventRow({
  event,
  last,
  canCancel,
  onCancel,
}: {
  event: any;
  last: boolean;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const { color } = useTheme();
  const schedule = [
    timeRange(event.startAt, event.endAt).replace(" - ", "–"),
    event.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const context = [
    event.club?.name ?? "School",
    event.status === "PUBLISHED"
      ? null
      : event.status?.replaceAll("_", " ").toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        minHeight: spacing.xl * 3,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderColor: color("border"),
      }}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Open ${event.title}`}
        onPress={() => router.push(`/events/${event._id}` as any)}
        style={{
          flex: 1,
          minWidth: 0,
          paddingLeft: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {context}
          </Txt>
          <Txt variant="label" numberOfLines={2}>
            {event.title}
          </Txt>
          {schedule ? (
            <Txt variant="caption" tone="muted" numberOfLines={2}>
              {schedule}
            </Txt>
          ) : null}
          {event.description ? (
            <Txt variant="caption" tone="muted" numberOfLines={2}>
              {event.description}
            </Txt>
          ) : null}
        </View>
        <ChevronRight size={spacing.lg} color={color("mutedForeground")} />
      </PressableScale>
      {canCancel ? (
        <View style={{ paddingHorizontal: spacing.sm }}>
          <IconButton
            icon={X}
            label={`Cancel ${event.title}`}
            size="sm"
            variant="destructive"
            onPress={onCancel}
          />
        </View>
      ) : (
        <View style={{ width: spacing.sm }} />
      )}
    </View>
  );
}


