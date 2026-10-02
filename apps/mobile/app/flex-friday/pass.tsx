import { displayName } from '~/apps/shared/user-name';
import { View } from "react-native";
import { useQuery } from "@/lib/convex-react";
import { Check, CircleDashed, MapPin, School } from "lucide-react-native";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Skeleton, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function FlexPassScreen() {
  const user = useCurrentUser();
  const liveRegistrations = useQuery(api.flexFriday.registration.getMyRegistrations, {});
  const liveAssignments = useQuery(api.flexFriday.registration.getMyAssignments, {});
  const registrations = useOfflineValue("flex-pass-registrations", liveRegistrations);
  const assignments = useOfflineValue("flex-pass-assignments", liveAssignments);
  const { color } = useTheme();
  const isLoading = registrations.value === undefined || assignments.value === undefined;
  const items = [...(assignments.value ?? []), ...(registrations.value ?? [])];
  const name = displayName(user) || "IA member";

  return (
    <Screen
      title="Flex pass"
      contentContainerStyle={{
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        gap: spacing.xl,
      }}
    >
      {registrations.isOffline || assignments.isOffline || registrations.isStale || assignments.isStale ? (
        <OfflineBanner stale={registrations.isStale || assignments.isStale} />
      ) : null}

      <View
        accessible
        accessibilityLabel={`Flex pass for ${name}`}
        style={{
          borderRadius: radii.lg,
          backgroundColor: color("secondary"),
          padding: spacing.lg,
          gap: spacing.xl,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <School size={22} color={color("primary")} strokeWidth={1.9} />
          <View style={{ minWidth: 0, flex: 1 }}>
            <Txt variant="overline" tone="muted">
              Innovation Academy
            </Txt>
            <Txt variant="label" style={{ fontWeight: "800" }}>
              Flex Friday
            </Txt>
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Txt variant="display" numberOfLines={2}>
            {name}
          </Txt>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          {isLoading ? (
            <CircleDashed size={18} color={color("mutedForeground")} />
          ) : items.length ? (
            <Check size={18} color={color("primary")} strokeWidth={2.4} />
          ) : (
            <CircleDashed size={18} color={color("mutedForeground")} />
          )}
          <Txt
            variant="label"
            tone={!isLoading && items.length ? "primary" : "muted"}
            style={{ fontWeight: "800" }}
          >
            {isLoading ? "Checking pass…" : items.length ? "Ready for check-in" : "No active check-in"}
          </Txt>
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Txt variant="section">Check-in schedule</Txt>
        <View style={{ gap: spacing.lg }}>
          {isLoading ? (
            <View style={{ minHeight: 68, justifyContent: "center", gap: spacing.sm }}>
              <Skeleton style={{ width: "64%", height: 18 }} />
              <Skeleton style={{ width: "42%", height: 14 }} />
            </View>
          ) : items.length === 0 ? (
            <Txt tone="muted">Your assigned or registered workshop will appear here.</Txt>
          ) : (
            items.map((item: any) => <CheckInRow key={item._id} item={item} />)
          )}
        </View>
      </View>
    </Screen>
  );
}

function CheckInRow({ item }: { item: any }) {
  const { color } = useTheme();
  const session = item.workshop?.sessions?.[0]?.session;
  const schedule = [
    session?.flexFriday?.date ? shortDate(session.flexFriday.date) : null,
    session?.title,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        minHeight: 64,
        gap: spacing.xs,
      }}
    >
      <Txt variant="section" numberOfLines={2}>
        {item.workshop?.title ?? "Workshop"}
      </Txt>
      {schedule ? (
        <Txt variant="caption" tone="muted" numberOfLines={2}>
          {schedule}
        </Txt>
      ) : null}
      {item.workshop?.location ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <MapPin size={13} color={color("mutedForeground")} />
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {item.workshop.location}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
