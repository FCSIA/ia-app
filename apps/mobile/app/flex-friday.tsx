import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { shortDate } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function FlexFridayScreen() {
  const fridays = useQuery(api.flexFriday.fridays.list, {});
  const registrations = useQuery(api.flexFriday.registration.getMyRegistrations, {});
  const assignments = useQuery(api.flexFriday.registration.getMyAssignments, {});
  const credits = useQuery(api.flexFriday.credits.getMyCredits, {});
  const { color } = useTheme();

  return (
    <Screen title="Flex Friday" subtitle="Browse upcoming Flex Fridays and keep your mobile pass close.">
      <Card style={{ gap: 8 }}>
        <Badge label="Pass" color="orange" />
        <Text style={{ color: color("foreground"), fontSize: 24, fontWeight: "900" }}>
          {credits?.earned ?? 0} credits earned
        </Text>
        <Text style={{ color: color("mutedForeground") }}>
          Registrations: {(registrations ?? []).length} · Assignments: {(assignments ?? []).length}
        </Text>
      </Card>

      <DataBoundary data={fridays} emptyTitle="No Flex Fridays scheduled">
        {(items) => (
          <View style={{ gap: 12 }}>
            {items.map((friday: any) => (
              <Card key={friday._id} style={{ gap: 8 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>
                  {shortDate(friday.date)}
                </Text>
                <Text style={{ color: color("mutedForeground") }}>
                  {friday.type.replaceAll("_", " ")} · {friday._count?.sessions ?? 0} sessions
                </Text>
                {friday.notes ? <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>{friday.notes}</Text> : null}
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
