import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { OfflineBanner } from "@/components/offline-banner";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth";
import { useOfflineValue } from "@/lib/offline-cache";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function FlexPassScreen() {
  const user = useCurrentUser();
  const liveRegistrations = useQuery(api.flexFriday.registration.getMyRegistrations, {});
  const liveAssignments = useQuery(api.flexFriday.registration.getMyAssignments, {});
  const registrations = useOfflineValue("flex-pass-registrations", liveRegistrations);
  const assignments = useOfflineValue("flex-pass-assignments", liveAssignments);
  const { color } = useTheme();
  const items = [...(assignments.value ?? []), ...(registrations.value ?? [])];

  return (
    <Screen title="Flex Pass" subtitle="Show this at check-in.">
      {registrations.isOffline || registrations.isStale || assignments.isStale ? (
        <OfflineBanner stale={registrations.isStale || assignments.isStale} />
      ) : null}
      <Card
        style={{
          gap: 14,
          padding: 24,
          backgroundColor: "#ffffff",
          borderColor: color("primary")
        }}
      >
        <Badge label="Innovation Academy" color="orange" />
        <Text style={{ color: "#111111", fontSize: 30, fontWeight: "900" }}>
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Student"}
        </Text>
        <Text style={{ color: "#333333", fontSize: 18 }}>{user?.uniqueId}</Text>
        <View style={{ height: 120, borderRadius: 14, backgroundColor: "#111111", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "900", letterSpacing: 0 }}>FLEX PASS</Text>
        </View>
        {items.length === 0 ? (
          <Text style={{ color: "#333333" }}>No active registration or assignment found.</Text>
        ) : (
          items.map((item: any) => (
            <View key={item._id} style={{ gap: 4 }}>
              <Text style={{ color: "#111111", fontWeight: "900" }}>{item.workshop?.title ?? "Workshop"}</Text>
              <Text style={{ color: "#444444" }}>
                {item.workshop?.sessions?.[0]?.session?.title ?? "Flex Friday"}
              </Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
