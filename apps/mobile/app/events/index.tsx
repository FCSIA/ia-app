import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useCurrentUser } from "@/lib/auth";
import { shortDate, timeRange } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function EventsScreen() {
  const user = useCurrentUser();
  const events = useQuery(api.events.events.list, {});
  const myClubs = useQuery(api.clubs.management.getMyClubs, {});
  const createEvent = useMutation(api.events.events.create);
  const cancelEvent = useMutation(api.events.events.cancel);
  const calendarWindow = useMemo(() => {
    const now = Date.now();
    return {
      startDate: now - 7 * 24 * 60 * 60 * 1000,
      endDate: now + 45 * 24 * 60 * 60 * 1000,
    };
  }, []);
  const calendarEntries = useQuery(api.events.calendar.list, calendarWindow);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", startAt: "", endAt: "", clubId: "" });
  const { color } = useTheme();
  const canCreateGeneral = !!user?.roles?.some((role) => ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"].includes(role));
  const availableClubs = useMemo(
    () =>
      [
        ...((myClubs?.memberOf ?? []).filter((club: any) => club.role === "LEADER" || club.role === "SPONSOR")),
        ...(myClubs?.sponsoring ?? []),
      ].filter((club: any, index: number, list: any[]) => list.findIndex((item) => item._id === club._id) === index),
    [myClubs],
  );
  const canCreate = canCreateGeneral || availableClubs.length > 0;
  const selectedClubId = form.clubId || (!canCreateGeneral ? availableClubs[0]?._id ?? "" : "");
  const filteredEvents = useMemo(() => {
    const value = search.trim().toLowerCase();
    return (events ?? []).filter((event: any) => {
      if (!value) return true;
      return [event.title, event.description, event.location, event.club?.name, event.status]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(value));
    });
  }, [events, search]);

  async function submitCreate() {
    const startAt = parseLocalDateTime(form.startAt);
    const endAt = form.endAt ? parseLocalDateTime(form.endAt) : undefined;
    if (!form.title.trim() || !startAt) {
      Alert.alert("Event", "Add a title and start date/time. Use YYYY-MM-DD HH:mm.");
      return;
    }
    if (!canCreateGeneral && !selectedClubId) {
      Alert.alert("Event", "Choose a club for this event.");
      return;
    }
    try {
      await createEvent({
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt,
        endAt: endAt ?? undefined,
        clubId: selectedClubId ? selectedClubId as any : undefined,
      });
      setForm({ title: "", description: "", location: "", startAt: "", endAt: "", clubId: "" });
      setShowCreate(false);
    } catch (error) {
      Alert.alert("Could not create event", error instanceof Error ? error.message : "Try again.");
    }
  }

  return (
    <Screen title="Events" subtitle="Agenda, approvals, creation, and event details.">
      <Card style={{ gap: 10 }}>
        <TextField value={search} onChangeText={setSearch} placeholder="Search events" />
        {canCreate ? (
          <Button title={showCreate ? "Cancel new event" : "Create event"} variant="secondary" onPress={() => setShowCreate((value) => !value)} />
        ) : null}
      </Card>

      {showCreate ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>New Event</Text>
          <TextField value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Title" />
          <TextField value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Description optional" multiline />
          <TextField value={form.location} onChangeText={(location) => setForm((current) => ({ ...current, location }))} placeholder="Location optional" />
          <TextField value={form.startAt} onChangeText={(startAt) => setForm((current) => ({ ...current, startAt }))} placeholder="Start YYYY-MM-DD HH:mm" />
          <TextField value={form.endAt} onChangeText={(endAt) => setForm((current) => ({ ...current, endAt }))} placeholder="End YYYY-MM-DD HH:mm optional" />
          {canCreateGeneral ? (
            <Button
              title="General event"
              variant={!form.clubId ? "primary" : "secondary"}
              onPress={() => setForm((current) => ({ ...current, clubId: "" }))}
            />
          ) : null}
          {availableClubs.map((club: any) => (
            <Button
              key={club._id}
              title={club.name}
              variant={selectedClubId === club._id ? "primary" : "secondary"}
              onPress={() => setForm((current) => ({ ...current, clubId: club._id }))}
            />
          ))}
          <Button title="Submit event" onPress={submitCreate} />
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Calendar</Text>
        {(calendarEntries ?? []).slice(0, 6).map((entry: any) => (
          <View key={entry._id} style={{ gap: 2 }}>
            <Text style={{ color: color("foreground"), fontWeight: "800" }}>{entry.title}</Text>
            <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
              {shortDate(entry.startAt)} - {timeRange(entry.startAt, entry.endAt)} - {entry.source}
            </Text>
          </View>
        ))}
        {calendarEntries?.length === 0 ? (
          <Text style={{ color: color("mutedForeground") }}>No calendar entries in the next few weeks.</Text>
        ) : null}
      </Card>

      <DataBoundary data={events} emptyTitle="No events">
        {() => (
          <View style={{ gap: 12 }}>
            {filteredEvents.map((event: any) => (
              <Pressable key={event._id} onPress={() => router.push(`/events/${event._id}` as any)}>
                <Card style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={event.status?.replaceAll("_", " ") ?? "Event"} color={event.status === "PUBLISHED" ? "emerald" : "amber"} />
                    <Badge label={event.club?.name ?? "General"} color={event.club ? "blue" : "gray"} />
                  </View>
                  <Text style={{ color: color("foreground"), fontSize: 19, fontWeight: "900" }}>{event.title}</Text>
                  {event.description ? (
                    <Text style={{ color: color("mutedForeground"), lineHeight: 20 }} numberOfLines={3}>{event.description}</Text>
                  ) : null}
                  <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                    {shortDate(event.startAt)} - {timeRange(event.startAt, event.endAt)}
                    {event.location ? ` - ${event.location}` : ""}
                  </Text>
                  {event.status === "PUBLISHED" && (event.authorId === user?._id || canCreateGeneral) ? (
                    <Button
                      title="Cancel event"
                      size="sm"
                      variant="tertiary"
                      onPress={() =>
                        cancelEvent({ eventId: event._id }).catch((error) =>
                          Alert.alert("Could not cancel", error instanceof Error ? error.message : "Try again."),
                        )
                      }
                    />
                  ) : null}
                </Card>
              </Pressable>
            ))}
            {filteredEvents.length === 0 ? (
              <Text style={{ color: color("mutedForeground"), textAlign: "center", fontWeight: "800" }}>No events match your search.</Text>
            ) : null}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}

function parseLocalDateTime(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) return null;
  const date = new Date(trimmed.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}
