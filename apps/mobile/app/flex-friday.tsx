import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortDate } from "@/lib/format";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
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
    selectedFriday?._id ? { flexFridayId: selectedFriday._id as any } : "skip"
  );
  const selectedSession = sessions?.find((session: any) => session._id === selectedSessionId) ?? sessions?.[0];
  const workshops = useQuery(
    api.flexFriday.workshops.listBySession,
    selectedFriday?._id && selectedSession?._id
      ? { flexFridayId: selectedFriday._id as any, sessionId: selectedSession._id as any }
      : "skip"
  );
  const registrations = useQuery(api.flexFriday.registration.getMyRegistrations, {});
  const assignments = useQuery(api.flexFriday.registration.getMyAssignments, {});
  const credits = useQuery(api.flexFriday.credits.getMyCredits, {});
  const register = useMutation(api.flexFriday.registration.register);
  const unregister = useMutation(api.flexFriday.registration.unregister);
  const { color } = useTheme();

  useEffect(() => {
    if (!selectedFridayId && selectedFriday?._id) setSelectedFridayId(selectedFriday._id);
  }, [selectedFriday?._id, selectedFridayId]);

  useEffect(() => {
    if (!selectedSessionId && selectedSession?._id) setSelectedSessionId(selectedSession._id);
  }, [selectedSession?._id, selectedSessionId]);

  return (
    <Screen title="Flex Friday" subtitle="Browse upcoming Flex Fridays and keep your mobile pass close.">
      {fridays.isOffline || fridays.isStale ? <OfflineBanner stale={fridays.isStale} /> : null}
      <Card style={{ gap: 8 }}>
        <Badge label="Pass" color="orange" />
        <Text style={{ color: color("foreground"), fontSize: 24, fontWeight: "900" }}>
          {credits?.earned ?? 0} credits earned
        </Text>
        <Text style={{ color: color("mutedForeground") }}>
          Registrations: {(registrations ?? []).length} · Assignments: {(assignments ?? []).length}
        </Text>
        <Button title="Open pass" variant="secondary" onPress={() => router.push("/flex-friday/pass" as never)} />
      </Card>

      <DataBoundary data={fridays.value} emptyTitle="No Flex Fridays scheduled">
        {(items) => (
          <View style={{ gap: 12 }}>
            {items.map((friday: any) => (
              <Pressable key={friday._id} onPress={() => setSelectedFridayId(friday._id)}>
              <Card
                style={{
                  gap: 8,
                  borderColor: selectedFriday?._id === friday._id ? color("primary") : color("border")
                }}
              >
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>
                  {shortDate(friday.date)}
                </Text>
                <Text style={{ color: color("mutedForeground") }}>
                  {friday.type.replaceAll("_", " ")} · {friday._count?.sessions ?? 0} sessions
                </Text>
                {friday.notes ? <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>{friday.notes}</Text> : null}
              </Card>
              </Pressable>
            ))}
          </View>
        )}
      </DataBoundary>

      {sessions?.length ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Sessions</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {sessions.map((session: any) => (
              <Button
                key={session._id}
                title={session.title}
                size="sm"
                variant={selectedSession?._id === session._id ? "primary" : "secondary"}
                onPress={() => setSelectedSessionId(session._id)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <DataBoundary data={workshops} emptyTitle="No workshops for this session">
        {(items) => (
          <View style={{ gap: 12 }}>
            {items.map((workshop: any) => {
              const isRegistered = workshop.registrations?.length > 0;
              const isAssigned = workshop.assignments?.length > 0;
              return (
                <Card key={workshop._id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {isRegistered ? <Badge label="Registered" color="emerald" /> : null}
                    {isAssigned ? <Badge label="Assigned" color="blue" /> : null}
                    {workshop.capacity ? <Badge label={`${workshop._count?.registrations ?? 0}/${workshop.capacity}`} color="amber" /> : null}
                  </View>
                  <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>{workshop.title}</Text>
                  {workshop.description ? (
                    <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>{workshop.description}</Text>
                  ) : null}
                  {workshop.location ? <Text style={{ color: color("mutedForeground") }}>{workshop.location}</Text> : null}
                  <Button
                    title={isRegistered ? "Unregister" : "Register"}
                    variant={isRegistered ? "tertiary" : "primary"}
                    disabled={isAssigned}
                    onPress={() =>
                      (isRegistered
                        ? unregister({ workshopId: workshop._id })
                        : register({ workshopId: workshop._id })
                      ).catch((error) =>
                        Alert.alert("Flex Friday", error instanceof Error ? error.message : "Try again.")
                      )
                    }
                  />
                </Card>
              );
            })}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
