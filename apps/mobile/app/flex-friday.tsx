import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, QrCode } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge, Button, FilterChip, PressableScale, Section, Txt, useToast } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function FlexFridayScreen() {
  const liveFridays = useQuery(api.flexFriday.fridays.list, {});
  const fridays = useOfflineValue("flex-fridays", liveFridays);
  const [selectedFridayId, setSelectedFridayId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [pendingWorkshopId, setPendingWorkshopId] = useState<string | null>(null);
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
  const { color } = useTheme();

  useEffect(() => {
    if (!selectedFridayId && selectedFriday?._id) setSelectedFridayId(selectedFriday._id);
  }, [selectedFriday?._id, selectedFridayId]);

  useEffect(() => {
    if (selectedSession?._id && selectedSession._id !== selectedSessionId) {
      setSelectedSessionId(selectedSession._id);
    }
  }, [selectedSession?._id, selectedSessionId]);

  async function updateRegistration(workshop: any, isRegistered: boolean) {
    setPendingWorkshopId(workshop._id);
    try {
      if (isRegistered) await unregister({ workshopId: workshop._id });
      else await register({ workshopId: workshop._id });
      showToast({ title: isRegistered ? "Registration removed" : "You’re registered", tone: "success" });
    } catch (error) {
      showToast({
        title: "Couldn’t update registration",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setPendingWorkshopId(null);
    }
  }

  const activeCount = (registrations ?? []).length + (assignments ?? []).length;

  return (
    <Screen title="Flex Friday" contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
      {fridays.isOffline || fridays.isStale ? <OfflineBanner stale={fridays.isStale} /> : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Show my Flex pass"
        onPress={() => router.push("/flex-friday/pass" as never)}
      >
        <View
          style={{
            minHeight: 84,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: color("primary"),
          }}
        >
          <QrCode size={23} color={color("primaryForeground")} strokeWidth={1.9} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="section" style={{ color: color("primaryForeground") }}>
              Flex pass
            </Txt>
            <Txt variant="caption" style={{ color: color("primaryForeground") }}>
              {credits?.earned ?? 0} of {credits?.required ?? 12} credits · {activeCount} active
            </Txt>
          </View>
          <ChevronRight size={20} color={color("primaryForeground")} />
        </View>
      </PressableScale>

      <DataBoundary data={fridays.value} emptyTitle="No Flex Fridays scheduled">
        {(items) => (
          <Section title="Choose a Friday">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            >
              {items.map((friday: any) => (
                <FilterChip
                  key={friday._id}
                  label={shortDate(friday.date)}
                  selected={selectedFriday?._id === friday._id}
                  onPress={() => {
                    setSelectedFridayId(friday._id);
                    setSelectedSessionId(null);
                  }}
                />
              ))}
            </ScrollView>
            {selectedFriday ? (
              <Txt variant="caption" tone="muted">
                {sentenceCase(selectedFriday.type)} · {selectedFriday._count?.sessions ?? 0} session
                {(selectedFriday._count?.sessions ?? 0) === 1 ? "" : "s"}
                {selectedFriday.notes ? ` · ${selectedFriday.notes}` : ""}
              </Txt>
            ) : null}
          </Section>
        )}
      </DataBoundary>

      {sessions?.length ? (
        <Section title="Session">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          >
            {sessions.map((session: any) => (
              <FilterChip
                key={session._id}
                label={session.title}
                selected={selectedSession?._id === session._id}
                onPress={() => setSelectedSessionId(session._id)}
              />
            ))}
          </ScrollView>
          {selectedSession?.startTime ? (
            <Txt variant="caption" tone="muted">
              {[selectedSession.startTime, selectedSession.endTime].filter(Boolean).join("–")}
            </Txt>
          ) : null}
        </Section>
      ) : null}

      {selectedFriday && selectedSession ? (
        <DataBoundary data={workshops} emptyTitle="No workshops in this session">
          {(items) => (
            <Section title="Workshops">
              <View
                style={{
                  overflow: "hidden",
                  borderRadius: radii.lg,
                  backgroundColor: color("card"),
                }}
              >
                {items.map((workshop: any, index) => (
                  <WorkshopRow
                    key={workshop._id}
                    workshop={workshop}
                    pending={pendingWorkshopId === workshop._id}
                    showDivider={index < items.length - 1}
                    onUpdate={updateRegistration}
                  />
                ))}
              </View>
            </Section>
          )}
        </DataBoundary>
      ) : null}
    </Screen>
  );
}

function WorkshopRow({
  workshop,
  pending,
  showDivider,
  onUpdate,
}: {
  workshop: any;
  pending: boolean;
  showDivider: boolean;
  onUpdate: (workshop: any, isRegistered: boolean) => void;
}) {
  const { color } = useTheme();
  const isRegistered = workshop.registrations?.length > 0;
  const isAssigned = workshop.assignments?.length > 0;
  const capacity = workshop.capacity
    ? `${workshop._count?.registrations ?? 0}/${workshop.capacity} seats`
    : null;
  const metadata = [workshop.location, capacity].filter(Boolean).join(" · ");

  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      <View
        style={{
          paddingVertical: spacing.md,
          gap: spacing.sm,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: color("border"),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt variant="section" numberOfLines={2}>
              {workshop.title}
            </Txt>
            {workshop.description ? (
              <Txt variant="caption" tone="muted" numberOfLines={2}>
                {workshop.description}
              </Txt>
            ) : null}
            {metadata ? (
              <Txt variant="caption" tone="muted" numberOfLines={1}>
                {metadata}
              </Txt>
            ) : null}
          </View>
          {isAssigned ? (
            <Badge label="Assigned" color="blue" />
          ) : isRegistered ? (
            <Badge label="Registered" color="emerald" />
          ) : null}
        </View>
        {!isAssigned ? (
          <Button
            title={isRegistered ? "Remove registration" : "Register"}
            size="sm"
            variant={isRegistered ? "ghost" : "primary"}
            loading={pending}
            disabled={pending}
            style={{ alignSelf: "flex-start" }}
            onPress={() => onUpdate(workshop, isRegistered)}
          />
        ) : null}
      </View>
    </View>
  );
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
