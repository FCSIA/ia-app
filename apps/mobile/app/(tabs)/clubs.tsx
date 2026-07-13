import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { Check, ChevronRight } from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Avatar, PressableScale, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubsScreen() {
  const all = useQuery(api.clubs.management.getAll, {});
  const mine = useQuery(api.clubs.management.getMyClubs, {});
  const { color } = useTheme();
  const memberIds = new Set((mine?.memberOf ?? []).map((club: any) => club._id));
  const sponsorIds = new Set((mine?.sponsoring ?? []).map((club: any) => club._id));

  return (
    <Screen header={<AppHeader title="Clubs" />}>
      <DataBoundary data={all} emptyTitle="No clubs yet">
        {(clubs) => (
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
            {clubs.map((club: any, index: number) => {
              const membershipLabel = sponsorIds.has(club._id) ? "Sponsor" : memberIds.has(club._id) ? "Joined" : null;
              const description = club.description ?? club.overview;
              const memberCount = club._count?.members ?? club.memberCount ?? 0;

              return (
                <PressableScale
                  key={club._id}
                  accessibilityLabel={`${club.name}, ${memberCount} ${memberCount === 1 ? "member" : "members"}${membershipLabel ? `, ${membershipLabel.toLowerCase()}` : ""}`}
                  onPress={() => router.push(`/clubs/${club._id}` as never)}
                  style={{
                    minHeight: 76,
                    paddingVertical: spacing.md,
                    borderBottomWidth: index === clubs.length - 1 ? 0 : 1,
                    borderBottomColor: color("border"),
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <Avatar uri={club.logoUrl} name={club.name} size={48} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Txt variant="section" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {club.name}
                      </Txt>
                      {membershipLabel ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                          <Check size={14} color={color("primary")} strokeWidth={2.4} />
                          <Txt variant="caption" tone="primary" style={{ fontWeight: "700" }}>
                            {membershipLabel}
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                    {description ? (
                      <Txt tone="muted" numberOfLines={2}>
                        {description}
                      </Txt>
                    ) : null}
                    <Txt variant="caption" tone="muted">
                      {memberCount} {memberCount === 1 ? "member" : "members"}
                    </Txt>
                  </View>
                  <ChevronRight size={20} color={color("mutedForeground")} strokeWidth={1.8} />
                </PressableScale>
              );
            })}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
