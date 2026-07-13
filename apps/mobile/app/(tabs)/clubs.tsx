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
  const memberIds = new Set((mine?.memberOf ?? []).map((club: any) => club._id));
  const sponsorIds = new Set((mine?.sponsoring ?? []).map((club: any) => club._id));
  const clubsReady = all === undefined || mine === undefined ? undefined : all;

  return (
    <Screen header={<AppHeader title="Clubs" />}>
      <DataBoundary data={clubsReady} emptyTitle="No clubs yet">
        {(clubs) => {
          const joinedClubs = clubs.filter((club: any) => memberIds.has(club._id));
          const sponsoredOnlyClubs = clubs.filter(
            (club: any) => !memberIds.has(club._id) && sponsorIds.has(club._id),
          );
          const myClubs = [...joinedClubs, ...sponsoredOnlyClubs];
          const otherClubs = clubs.filter(
            (club: any) => !memberIds.has(club._id) && !sponsorIds.has(club._id),
          );

          return (
            <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.xl }}>
              {myClubs.length ? (
                <ClubGroup
                  title="My clubs"
                  clubs={myClubs}
                  memberIds={memberIds}
                  sponsorIds={sponsorIds}
                />
              ) : null}
              {otherClubs.length ? (
                <ClubGroup
                  title={myClubs.length ? "Other clubs" : "All clubs"}
                  clubs={otherClubs}
                  memberIds={memberIds}
                  sponsorIds={sponsorIds}
                />
              ) : null}
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}

function ClubGroup({
  title,
  clubs,
  memberIds,
  sponsorIds,
}: {
  title: string;
  clubs: any[];
  memberIds: Set<string>;
  sponsorIds: Set<string>;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="overline" tone="muted">
        {title}
      </Txt>
      <View>
        {clubs.map((club: any, index: number) => (
          <ClubRow
            key={club._id}
            club={club}
            membershipLabel={
              sponsorIds.has(club._id) ? "Sponsor" : memberIds.has(club._id) ? "Joined" : null
            }
            showDivider={index < clubs.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function ClubRow({
  club,
  membershipLabel,
  showDivider,
}: {
  club: any;
  membershipLabel: "Sponsor" | "Joined" | null;
  showDivider: boolean;
}) {
  const { color } = useTheme();
  const description = club.description ?? club.overview;
  const memberCount = club._count?.members ?? club.memberCount ?? 0;

  return (
    <PressableScale
      accessibilityLabel={`${club.name}, ${memberCount} ${memberCount === 1 ? "member" : "members"}${membershipLabel ? `, ${membershipLabel.toLowerCase()}` : ""}`}
      onPress={() => router.push(`/clubs/${club._id}` as never)}
      style={{
        minHeight: 76,
        paddingVertical: spacing.md,
        borderBottomWidth: showDivider ? 1 : 0,
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
}
