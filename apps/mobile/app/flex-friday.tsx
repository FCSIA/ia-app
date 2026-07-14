import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  QrCode,
} from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import {
  Button,
  PressableScale,
  Section,
  Txt,
  useToast,
} from "@/components/ui";
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
    <Screen
      title="Flex Friday"
      contentContainerStyle={{
        width: "100%",
        maxWidth: 760,
        alignSelf: "center",
        gap: spacing.xl,
      }}
    >
      {fridays.isOffline || fridays.isStale ? <OfflineBanner stale={fridays.isStale} /> : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Show my Flex pass"
        onPress={() => router.push("/flex-friday/pass" as never)}
      >
        <View
          style={{
            minHeight: 76,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: color("secondary"),
          }}
        >
          <QrCode size={22} color={color("primary")} strokeWidth={1.9} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="label" style={{ fontWeight: "800" }}>
              My pass
            </Txt>
            <Txt variant="caption" tone="muted">
              {credits?.earned ?? 0} of {credits?.required ?? 12} credits · {activeCount} active
            </Txt>
          </View>
          <ChevronRight size={19} color={color("mutedForeground")} />
        </View>
      </PressableScale>

      <DataBoundary data={fridays.value} emptyTitle="No Flex Fridays scheduled">
        {(items) => (
          <Section title="Dates">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            >
              {items.map((friday: any) => (
                <DateOption
                  key={friday._id}
                  date={friday.date}
                  type={sentenceCase(friday.type)}
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
                {selectedFriday._count?.sessions ?? 0} session
                {(selectedFriday._count?.sessions ?? 0) === 1 ? "" : "s"}
                {selectedFriday.notes ? ` · ${selectedFriday.notes}` : ""}
              </Txt>
            ) : null}
          </Section>
        )}
      </DataBoundary>

      {sessions?.length ? (
        <Section title="Sessions">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          >
            {sessions.map((session: any) => (
              <SessionOption
                key={session._id}
                title={session.title}
                time={[session.startTime, session.endTime]
                  .filter(Boolean)
                  .join("–")}
                selected={selectedSession?._id === session._id}
                onPress={() => setSelectedSessionId(session._id)}
              />
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {selectedFriday && selectedSession ? (
        <DataBoundary data={workshops} emptyTitle="No workshops in this session">
          {(items) => (
            <Section
              title="Workshops"
              action={
                <Txt variant="caption" tone="muted">
                  {items.length}
                </Txt>
              }
            >
              <View style={{ gap: spacing.xl }}>
                {items.map((workshop: any) => (
                  <WorkshopRow
                    key={workshop._id}
                    workshop={workshop}
                    pending={pendingWorkshopId === workshop._id}
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
  onUpdate,
}: {
  workshop: any;
  pending: boolean;
  onUpdate: (workshop: any, isRegistered: boolean) => void;
}) {
  const { color } = useTheme();
  const isRegistered = workshop.registrations?.length > 0;
  const isAssigned = workshop.assignments?.length > 0;
  const capacity = workshop.capacity
    ? `${workshop._count?.registrations ?? 0}/${workshop.capacity} seats`
    : null;
  const isFull =
    !!workshop.capacity &&
    (workshop._count?.registrations ?? 0) >= workshop.capacity;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
          <Txt variant="section" numberOfLines={2}>
            {workshop.title}
          </Txt>
          {workshop.description ? (
            <Txt variant="body" tone="muted" numberOfLines={3}>
              {workshop.description}
            </Txt>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            {workshop.location ? (
              <WorkshopDetail icon={MapPin} label={workshop.location} />
            ) : null}
            {capacity ? <WorkshopDetail label={capacity} /> : null}
          </View>
        </View>
      </View>

      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        {isAssigned || isRegistered ? (
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <Check size={16} color={color("primary")} strokeWidth={2.4} />
            <Txt variant="label" tone="primary">
              {isAssigned ? "Assigned to you" : "Registered"}
            </Txt>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {!isAssigned ? (
          <Button
            title={isRegistered ? "Remove" : isFull ? "Full" : "Register"}
            size="sm"
            variant={isRegistered ? "ghost" : "secondary"}
            loading={pending}
            disabled={pending || (isFull && !isRegistered)}
            onPress={() => onUpdate(workshop, isRegistered)}
          />
        ) : null}
      </View>
    </View>
  );
}

function DateOption({
  date,
  type,
  selected,
  onPress,
}: {
  date: number;
  type: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={`${shortDate(date)}, ${type}`}
      accessibilityState={{ selected }}
      haptic={false}
      onPress={onPress}
      style={{
        minWidth: 112,
        minHeight: 58,
        borderRadius: radii.md,
        backgroundColor: selected ? color("secondary") : "transparent",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Txt variant="label" tone={selected ? "primary" : "default"}>
        {shortDate(date)}
      </Txt>
      <Txt variant="caption" tone="muted" numberOfLines={1}>
        {type}
      </Txt>
    </PressableScale>
  );
}

function SessionOption({
  title,
  time,
  selected,
  onPress,
}: {
  title: string;
  time: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={`${title}, ${time}`}
      accessibilityState={{ selected }}
      haptic={false}
      onPress={onPress}
      style={{
        minWidth: 136,
        minHeight: 58,
        borderRadius: radii.md,
        backgroundColor: selected ? color("secondary") : "transparent",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Txt variant="label" tone={selected ? "primary" : "default"} numberOfLines={1}>
        {title}
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Clock3 size={12} color={color("mutedForeground")} />
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {time}
        </Txt>
      </View>
    </PressableScale>
  );
}

function WorkshopDetail({
  icon: Icon,
  label,
}: {
  icon?: typeof MapPin;
  label: string;
}) {
  const { color } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {Icon ? <Icon size={13} color={color("mutedForeground")} /> : null}
      <Txt variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
