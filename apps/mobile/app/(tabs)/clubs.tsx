import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubsScreen() {
  const all = useQuery(api.clubs.management.getAll, {});
  const mine = useQuery(api.clubs.management.getMyClubs, {});
  const { color } = useTheme();
  const myIds = new Set([...(mine?.memberOf ?? []), ...(mine?.sponsoring ?? [])].map((club: any) => club._id));

  return (
    <Screen title="Clubs" subtitle="Find communities, channels, and sponsor updates.">
      <DataBoundary data={all} emptyTitle="No clubs yet">
        {(clubs) => (
          <View style={{ gap: 12 }}>
            {clubs.map((club: any) => (
              <Pressable key={club._id} onPress={() => router.push(`/clubs/${club._id}`)}>
                <Card style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900", flex: 1 }}>{club.name}</Text>
                    {myIds.has(club._id) ? <Badge label="Joined" color="emerald" /> : null}
                  </View>
                  <Text style={{ color: color("mutedForeground"), lineHeight: 20 }} numberOfLines={3}>
                    {club.description ?? club.overview ?? "Club workspace"}
                  </Text>
                  <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
                    {club._count?.members ?? club.memberCount ?? 0} members
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
