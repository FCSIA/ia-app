import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubDetailScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const club = useQuery(api.clubs.detail.get, clubId ? { clubId: clubId as any } : "skip");
  const joinOpen = useMutation(api.clubs.invitations.joinOpenClub);
  const requestJoin = useMutation(api.clubs.invitations.requestToJoin);
  const { color } = useTheme();

  return (
    <Screen>
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data) => (
          <>
            <Card style={{ gap: 12 }}>
              <Badge
                label={
                  data.viewer?.canAccessWorkspace
                    ? "Workspace"
                    : data.viewer?.hasPendingJoinRequest
                      ? "Requested"
                      : data.joinPolicy ?? "Club"
                }
                color="orange"
              />
              <Text style={{ color: color("foreground"), fontSize: 28, fontWeight: "900" }}>{data.name}</Text>
              <Text style={{ color: color("mutedForeground"), lineHeight: 22 }}>
                {data.overview ?? data.description ?? "Club workspace"}
              </Text>
              {!data.viewer?.canAccessWorkspace ? (
                <Button
                  title={data.joinPolicy === "OPEN" ? "Join club" : "Request to join"}
                  onPress={() =>
                    data.joinPolicy === "OPEN"
                      ? joinOpen({ clubId: clubId as any })
                      : requestJoin({ clubId: clubId as any })
                  }
                />
              ) : null}
            </Card>

            {data.viewer?.canAccessWorkspace ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Channels</Text>
                {data.channels.map((channel: any) => (
                  <Pressable
                    key={channel._id}
                    onPress={() => router.push(`/clubs/${clubId}/channels/${channel._id}`)}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text style={{ color: color("foreground"), fontWeight: "800" }}>#{channel.name}</Text>
                    {channel.description ? (
                      <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{channel.description}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </DataBoundary>
    </Screen>
  );
}
