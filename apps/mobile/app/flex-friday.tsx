import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { QrCode } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge, Button, Card, ChipGroup, IconButton, Section, Stat, Txt, useToast } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useOfflineValue } from "@/lib/offline-cache";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function FlexFridayScreen() {
  const liveFridays = useQuery(api.flexFriday.fridays.list, {});
  const fridays = useOfflineValue("flex-fridays", liveFridays);
  const [selectedFridayId, setSelectedFridayId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const fridayList = fridays.value ?? [];
  const selectedFriday = fridayList.find((friday: any) => friday._id === selectedFridayId) ?? fridayList[0];
  const sessions = useQuery(
    api.flexFriday.sessions.listByFriday,
    selectedFriday?._id ? { flexFridayId: selectedFriday._id as any } : "skip",
  );
  const selectedSession = sessions?.find((session: any) => session._id === selectedSessionId) ?? sessions?.[0];
  const workshops = useQuery(
    api.flexFriday.workshops.listBySession,
    selectedFriday?._id && selectedSession?._id
      ? { flexFridayId: selectedFriday._id as any, sessionId: selectedSession._id as any }
      : "skip",
  );
  const registrations = useQuery(api.flexFriday.registration.getMyRegistrations, {});
  const assignments = useQuery(api.flexFriday.registration.getMyAssignments, {});
  const credits = useQuery(api.flexFriday.credits.getMyCredits, {});
  const register = useMutation(api.flexFriday.registration.register);
  const unregister = useMutation(api.flexFriday.registration.unregister);
  const { showToast } = useToast();

  useEffect(() => {
    if (!selectedFridayId && selectedFriday?._id) setSelectedFridayId(selectedFriday._id);
  }, [selectedFriday?._id, selectedFridayId]);

  useEffect(() => {
    if (!selectedSessionId && selectedSession?._id) setSelectedSessionId(selectedSession._id);
  }, [selectedSession?._id, selectedSessionId]);

  return (
    <Screen title="Flex Friday" subtitle="Browse sessions, register, and keep your pass close.">
      {fridays.isOffline || fridays.isStale ? <OfflineBanner stale={fridays.isStale} /> : null}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconButton icon={QrCode} label="Show my pass" variant="primary" onPress={() => router.push("/flex-friday/pass" as never)} />
          <View style={{ flex: 1 }}>
            <Txt variant="title">Show my pass</Txt>
            <Txt tone="muted">Ready for check-in and attendance.</Txt>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Stat value={credits?.earned ?? 0} label="credits earned" />
          </View>
          <View style={{ flex: 1 }}>
            <Stat value={(registrations ?? []).length + (assignments ?? []).length} label="active items" />
          </View>
        </View>
        <Button title="Show my pass" onPress={() => router.push("/flex-friday/pass" as never)} />
      </Card>

      <DataBoundary data={fridays.value} emptyTitle="No Flex Fridays scheduled">
        {(items) => (
          <Section title="Fridays">
            {items.map((friday: any) => (
              <Card
                key={friday._id}
                onPress={() => setSelectedFridayId(friday._id)}
                style={{ gap: spacing.sm, borderWidth: selectedFriday?._id === friday._id ? 2 : 1 }}
              >
                <Txt variant="section">{shortDate(friday.date)}</Txt>
                <Txt tone="muted">
                  {friday.type.replaceAll("_", " ")} - {friday._count?.sessions ?? 0} sessions
                </Txt>
                {friday.notes ? <Txt tone="muted">{friday.notes}</Txt> : null}
              </Card>
            ))}
          </Section>
        )}
      </DataBoundary>

      {sessions?.length ? (
        <Section title="Sessions">
          <ChipGroup
            values={sessions.map((session: any) => session._id)}
            selected={selectedSession?._id ? [selectedSession._id] : []}
            labels={Object.fromEntries(sessions.map((session: any) => [session._id, session.title]))}
            onToggle={(sessionId) => setSelectedSessionId(sessionId)}
          />
        </Section>
      ) : null}

      {selectedFriday && selectedSession ? (
        <DataBoundary data={workshops} emptyTitle="No workshops for this session">
          {(items) => (
            <Section title="Workshops">
              {items.map((workshop: any) => {
                const isRegistered = workshop.registrations?.length > 0;
                const isAssigned = workshop.assignments?.length > 0;
                return (
                  <Card key={workshop._id} style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      {isRegistered ? <Badge label="Registered" color="emerald" /> : null}
                      {isAssigned ? <Badge label="Assigned" color="blue" /> : null}
                      {workshop.capacity ? <Badge label={`${workshop._count?.registrations ?? 0}/${workshop.capacity}`} color="amber" /> : null}
                    </View>
                    <Txt variant="section">{workshop.title}</Txt>
                    {workshop.description ? <Txt tone="muted">{workshop.description}</Txt> : null}
                    {workshop.location ? <Txt tone="muted">{workshop.location}</Txt> : null}
                    <Button
                      title={isRegistered ? "Unregister" : "Register"}
                      variant={isRegistered ? "tertiary" : "primary"}
                      disabled={isAssigned}
                      onPress={() =>
                        (isRegistered
                          ? unregister({ workshopId: workshop._id })
                          : register({ workshopId: workshop._id })
                        ).then(() => showToast({ title: isRegistered ? "Registration removed" : "Registered", tone: "success" }))
                          .catch((error) => showToast({ title: "Flex Friday", body: error instanceof Error ? error.message : "Try again." }))
                      }
                    />
                  </Card>
                );
              })}
            </Section>
          )}
        </DataBoundary>
      ) : null}
    </Screen>
  );
}
