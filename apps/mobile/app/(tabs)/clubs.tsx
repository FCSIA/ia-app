import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { AppHeader } from "@/components/app-header";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Avatar, Badge, Card, Stat, Txt } from "@/components/ui";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubsScreen() {
  const all = useQuery(api.clubs.management.getAll, {});
  const mine = useQuery(api.clubs.management.getMyClubs, {});
  const myIds = new Set([...(mine?.memberOf ?? []), ...(mine?.sponsoring ?? [])].map((club: any) => club._id));

  return (
    <Screen header={<AppHeader title="Clubs" subtitle="Find communities, channels, and sponsor updates." />}>
      <DataBoundary data={all} emptyTitle="No clubs yet">
        {(clubs) => (
          <View style={{ gap: spacing.md }}>
            {clubs.map((club: any) => (
              <Card key={club._id} onPress={() => router.push(`/clubs/${club._id}` as never)} style={{ gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Avatar uri={club.logoUrl} name={club.name} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="section" numberOfLines={1}>{club.name}</Txt>
                    <Txt tone="muted" numberOfLines={2}>{club.description ?? club.overview ?? "Club workspace"}</Txt>
                  </View>
                  {myIds.has(club._id) ? <Badge label="Joined" color="emerald" /> : null}
                </View>
                <Stat value={club._count?.members ?? club.memberCount ?? 0} label="members" />
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
