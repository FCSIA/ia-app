import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Badge, Button, Card, ChipGroup, Section, Sheet, TextField, Txt, useToast } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { shortDate, timeRange } from "@/lib/format";
import { spacing } from "@/lib/tokens";
import { warning } from "@/lib/haptics";
import { api } from "~/apps/convex/src/_generated/api";

export function EventsView() {
  const user = useCurrentUser();
  const events = useQuery(api.events.events.list, {});
  const myClubs = useQuery(api.clubs.management.getMyClubs, {});
  const createEvent = useMutation(api.events.events.create);
  const cancelEvent = useMutation(api.events.events.cancel);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", location: "", startAt: "", endAt: "", clubId: "" });
  const { showToast } = useToast();
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
      showToast({ title: "Add event details", body: "Use YYYY-MM-DD HH:mm for the start." });
      return;
    }
    if (!canCreateGeneral && !selectedClubId) {
      showToast({ title: "Choose a club", body: "Club-scoped creators need an eligible club." });
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
      showToast({ title: "Event submitted", tone: "success" });
    } catch (error) {
      showToast({ title: "Could not create event", body: error instanceof Error ? error.message : "Try again." });
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.md }}>
        <TextField value={search} onChangeText={setSearch} placeholder="Search events" />
        {canCreate ? <Button title="Create event" variant="secondary" onPress={() => setShowCreate(true)} /> : null}
      </Card>

      <DataBoundary data={events} emptyTitle="No events">
        {() => (
          <Section title="Events">
            {filteredEvents.map((event: any) => (
              <Card key={event._id} onPress={() => router.push(`/events/${event._id}` as any)} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  <Badge label={event.status?.replaceAll("_", " ") ?? "Event"} color={event.status === "PUBLISHED" ? "emerald" : "amber"} />
                  <Badge label={event.club?.name ?? "General"} color={event.club ? "blue" : "gray"} />
                </View>
                <Txt variant="section">{event.title}</Txt>
                {event.description ? <Txt tone="muted" numberOfLines={3}>{event.description}</Txt> : null}
                <Txt variant="caption" tone="muted">
                  {shortDate(event.startAt)} - {timeRange(event.startAt, event.endAt)}
                  {event.location ? ` - ${event.location}` : ""}
                </Txt>
                {event.status === "PUBLISHED" && (event.authorId === user?._id || canCreateGeneral) ? (
                  <Button
                    title="Cancel event"
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      void warning();
                      Alert.alert("Cancel event?", "This removes it from the published event list.", [
                        { text: "Keep", style: "cancel" },
                        {
                          text: "Cancel event",
                          style: "destructive",
                          onPress: () => cancelEvent({ eventId: event._id }).catch((error) => showToast({ title: "Could not cancel", body: error instanceof Error ? error.message : "Try again." })),
                        },
                      ]);
                    }}
                  />
                ) : null}
              </Card>
            ))}
            {filteredEvents.length === 0 ? <Txt tone="muted" style={{ textAlign: "center" }}>No events match your search.</Txt> : null}
          </Section>
        )}
      </DataBoundary>

      <Sheet open={showCreate} onClose={() => setShowCreate(false)} title="New Event">
        <TextField value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Title" />
        <TextField value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Description optional" multiline />
        <TextField value={form.location} onChangeText={(location) => setForm((current) => ({ ...current, location }))} placeholder="Location optional" />
        <TextField value={form.startAt} onChangeText={(startAt) => setForm((current) => ({ ...current, startAt }))} placeholder="Start YYYY-MM-DD HH:mm" />
        <TextField value={form.endAt} onChangeText={(endAt) => setForm((current) => ({ ...current, endAt }))} placeholder="End YYYY-MM-DD HH:mm optional" />
        {canCreateGeneral ? (
          <ChipGroup values={["GENERAL"] as const} selected={!form.clubId ? ["GENERAL"] : []} onToggle={() => setForm((current) => ({ ...current, clubId: "" }))} />
        ) : null}
        <ChipGroup
          values={availableClubs.map((club: any) => club._id)}
          selected={selectedClubId ? [selectedClubId] : []}
          labels={Object.fromEntries(availableClubs.map((club: any) => [club._id, club.name]))}
          onToggle={(clubId) => setForm((current) => ({ ...current, clubId }))}
        />
        <Button title="Submit event" onPress={submitCreate} />
      </Sheet>
    </View>
  );
}

function parseLocalDateTime(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) return null;
  const date = new Date(trimmed.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}
