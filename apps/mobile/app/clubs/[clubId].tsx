import { Alert, Pressable, Text, View } from "react-native";
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
  const respondToJoinRequest = useMutation(api.clubs.invitations.respondToJoinRequest);
  const { color } = useTheme();

  return (
    <Screen>
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data) => {
          const hasPendingJoinRequest = !!data.viewer?.hasPendingJoinRequest;

          return (
            <>
            <Card style={{ gap: 12 }}>
              <Badge
                label={
                  data.viewer?.canAccessWorkspace
                    ? "Workspace"
                    : hasPendingJoinRequest
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
                  title={hasPendingJoinRequest ? "Request pending" : data.joinPolicy === "OPEN" ? "Join club" : "Request to join"}
                  disabled={hasPendingJoinRequest}
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

            {data.viewer?.canApproveJoinRequests && data.pendingJoinRequests?.length ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Join requests</Text>
                {data.pendingJoinRequests.map((request: any) => (
                  <View key={request._id} style={{ gap: 8 }}>
                    <Text style={{ color: color("foreground"), fontWeight: "800" }}>
                      {[request.requester?.firstName, request.requester?.lastName].filter(Boolean).join(" ")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button
                        title="Approve"
                        size="sm"
                        onPress={() =>
                          respondToJoinRequest({ clubId: clubId as any, requestId: request._id, accept: true }).catch(
                            (error) => Alert.alert("Could not approve", error instanceof Error ? error.message : "Try again.")
                          )
                        }
                      />
                      <Button
                        title="Decline"
                        size="sm"
                        variant="tertiary"
                        onPress={() =>
                          respondToJoinRequest({ clubId: clubId as any, requestId: request._id, accept: false }).catch(
                            (error) => Alert.alert("Could not decline", error instanceof Error ? error.message : "Try again.")
                          )
                        }
                      />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
            </>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}
