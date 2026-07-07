import { Text, View } from "react-native";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function WrappedScreen() {
  const user = useCurrentUser();
  const availability = useQuery(api.wrapped.snapshots.availability, {});
  const isAdmin = !!user?.roles?.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role));
  const summary = useQuery(
    api.wrapped.snapshots.getMine,
    availability?.open || isAdmin ? {} : "skip",
  );
  const { color } = useTheme();

  return (
    <Screen title="Wrapped" subtitle="Your school-year activity summary.">
      <DataBoundary data={availability} emptyTitle="Wrapped unavailable">
        {(window) => (
          <Card style={{ gap: 10 }}>
            <Badge label={window.schoolYearLabel} color={window.open ? "emerald" : "amber"} />
            <Text style={{ color: color("foreground"), fontSize: 24, fontWeight: "900" }}>
              {window.open ? "Wrapped is open" : "Wrapped opens in May"}
            </Text>
            <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
              {window.open
                ? `Available until ${new Date(window.closesAt).toLocaleDateString()}.`
                : `Opens ${new Date(window.opensAt).toLocaleDateString()}. Admin previews may still load directly.`}
            </Text>
          </Card>
        )}
      </DataBoundary>

      {availability?.open || isAdmin ? (
        <DataBoundary data={summary} emptyTitle="No Wrapped summary yet">
          {(item) => (
          <View style={{ gap: 12 }}>
            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 26, fontWeight: "900" }}>
                {item.schoolYearLabel}
              </Text>
              <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
                {new Date(item.rangeStart).toLocaleDateString()} - {new Date(item.rangeEnd).toLocaleDateString()}
              </Text>
            </Card>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Stat label="Messages" value={item.messagesSent} />
              <Stat label="Channels" value={item.channelsEngaged} />
              <Stat label="Friends" value={item.friends} />
              <Stat label="Clubs" value={item.clubs} />
              <Stat label="Flex Credits" value={`${item.flexCredits}/${item.flexCreditsRequired}`} />
              <Stat label="Pathway Credits" value={item.pathwayFlexCredits} />
            </View>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Highlights</Text>
              <Highlight label="Top channel" value={item.topChannel ? `${item.topChannel.clubName} #${item.topChannel.channelName}` : "No channel activity yet"} />
              <Highlight label="Most used word" value={item.mostUsedWord ? `${item.mostUsedWord.word} (${item.mostUsedWord.count})` : "Not enough messages yet"} />
              <Highlight label="Top emoji" value={item.topEmoji ? `${item.topEmoji.emoji} (${item.topEmoji.count})` : "No reactions yet"} />
              <Highlight label="Longest streak" value={`${item.longestStreak} day${item.longestStreak === 1 ? "" : "s"}`} />
              <Highlight label="Most active day" value={item.mostActiveDay ? `${item.mostActiveDay.date} (${item.mostActiveDay.messages})` : "No active day yet"} />
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Pathway</Text>
              <Highlight label="Major" value={item.pathway.label ?? item.pathway.major ?? "Unassigned"} />
              <Highlight label="Peers" value={`${item.pathway.peers}`} />
              <Highlight label="Lanyard" value={item.pathway.lanyardColor ?? "Not set"} />
            </Card>
          </View>
          )}
        </DataBoundary>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  const { color } = useTheme();
  return (
    <Card style={{ width: "48%", gap: 4, minHeight: 92 }}>
      <Text style={{ color: color("foreground"), fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: color("mutedForeground"), fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </Card>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: color("mutedForeground"), fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: color("foreground"), fontWeight: "900" }}>{value}</Text>
    </View>
  );
}
