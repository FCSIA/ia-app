import { View } from "react-native";
import { useQuery } from "convex/react";
import { CheckCircle2, School } from "lucide-react-native";
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
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "IA member";

  return (
    <Screen title="Flex pass" contentContainerStyle={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
      {registrations.isOffline || assignments.isOffline || registrations.isStale || assignments.isStale ? (
        <OfflineBanner stale={registrations.isStale || assignments.isStale} />
      ) : null}

      <View
        accessible
        accessibilityLabel={`Flex pass for ${name}`}
        style={{
          overflow: "hidden",
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: color("border"),
          backgroundColor: color("card"),
        }}
      >
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radii.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color("primary"),
              }}
            >
              <School size={23} color={color("primaryForeground")} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="overline" tone="muted">
                Innovation Academy
              </Txt>
              <Txt variant="section">Flex Friday</Txt>
            </View>
          </View>

          <View style={{ gap: 3 }}>
            <Txt variant="display" numberOfLines={2}>
              {name}
            </Txt>
            {user?.uniqueId ? (
              <Txt variant="label" tone="muted">
                {user.uniqueId}
              </Txt>
            ) : null}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            backgroundColor: !isLoading && items.length ? color("primary") : color("secondary"),
          }}
        >
          {!isLoading && items.length ? <CheckCircle2 size={21} color={color("primaryForeground")} /> : null}
          <Txt
            variant="section"
            style={{ color: !isLoading && items.length ? color("primaryForeground") : color("foreground") }}
          >
            {isLoading ? "Checking pass…" : items.length ? "Ready for check-in" : "No active check-in"}
          </Txt>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          {isLoading ? (
            <View style={{ minHeight: 68, justifyContent: "center", gap: spacing.sm }}>
              <Skeleton style={{ width: "64%", height: 18 }} />
              <Skeleton style={{ width: "42%", height: 14 }} />
            </View>
          ) : items.length === 0 ? (
            <Txt tone="muted">Your assigned or registered workshop will appear here.</Txt>
          ) : (
            items.map((item: any, index) => (
              <CheckInRow key={item._id} item={item} showDivider={index < items.length - 1} />
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

function CheckInRow({ item, showDivider }: { item: any; showDivider: boolean }) {
  const { color } = useTheme();
  const session = item.workshop?.sessions?.[0]?.session;
  const details = [
    session?.flexFriday?.date ? shortDate(session.flexFriday.date) : null,
    session?.title,
    item.workshop?.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        minHeight: 68,
        justifyContent: "center",
        gap: 3,
        paddingVertical: spacing.md,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: color("border"),
      }}
    >
      <Txt variant="section" numberOfLines={2}>
        {item.workshop?.title ?? "Workshop"}
      </Txt>
      {details ? (
        <Txt variant="caption" tone="muted" numberOfLines={2}>
          {details}
        </Txt>
      ) : null}
    </View>
  );
}
