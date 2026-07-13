import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronRight, Hash, Tags, UsersRound } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Avatar, Button, PressableScale, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
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
          const canAccessWorkspace = !!data.viewer?.canAccessWorkspace;

          async function joinClub() {
            try {
              if (data.joinPolicy === "OPEN") {
                await joinOpen({ clubId: clubId as any });
              } else {
                await requestJoin({ clubId: clubId as any });
              }
            } catch (error) {
              Alert.alert("Could not join", error instanceof Error ? error.message : "Try again.");
            }
          }

          return (
            <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.xl }}>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Avatar uri={data.logoUrl} name={data.name} size={60} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Txt variant="display" style={{ fontSize: 28, lineHeight: 33 }}>
                      {data.name}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {data._count?.members ?? 0} {(data._count?.members ?? 0) === 1 ? "member" : "members"}
                    </Txt>
                  </View>
                </View>
                {data.overview ?? data.description ? (
                  <Txt tone="muted" style={{ lineHeight: 23 }}>
                    {data.overview ?? data.description}
                  </Txt>
                ) : null}
                {!canAccessWorkspace ? (
                  <Button
                    title={hasPendingJoinRequest ? "Request pending" : data.joinPolicy === "OPEN" ? "Join club" : "Request to join"}
                    disabled={hasPendingJoinRequest}
                    onPress={joinClub}
                  />
                ) : null}
              </View>

              {canAccessWorkspace ? (
                <>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      title="People"
                      icon={UsersRound}
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/clubs/${clubId}/people`)}
                    />
                    <Button
                      title="Tags"
                      icon={Tags}
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/clubs/${clubId}/tags`)}
                    />
                  </View>

                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                      <Txt variant="section">Channels</Txt>
                      <Txt variant="caption" tone="muted">
                        {data.channels.length}
                      </Txt>
                    </View>
                    <View>
                      {data.channels.map((channel: any, index: number) => {
                        const messageCount = channel._count?.messages ?? 0;
                        const metadata = [
                          channel.description,
                          `${messageCount} ${messageCount === 1 ? "message" : "messages"}`,
                        ].filter(Boolean).join(" · ");

                        return (
                          <PressableScale
                            key={channel._id}
                            accessibilityLabel={`Open ${channel.name} channel`}
                            onPress={() => router.push(`/clubs/${clubId}/channels/${channel._id}`)}
                            style={{
                              minHeight: 64,
                              paddingVertical: spacing.md,
                              borderBottomWidth: index === data.channels.length - 1 ? 0 : 1,
                              borderBottomColor: color("border"),
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.md,
                            }}
                          >
                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: radii.md,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: color("secondary"),
                              }}
                            >
                              <Hash size={19} color={color("foreground")} strokeWidth={1.9} />
                            </View>
                            <View style={{ flex: 1, gap: spacing.xs }}>
                              <Txt style={{ fontWeight: "700" }} numberOfLines={1}>
                                {channel.name}
                              </Txt>
                              <Txt variant="caption" tone="muted" numberOfLines={2}>
                                {metadata}
                              </Txt>
                            </View>
                            <ChevronRight size={20} color={color("mutedForeground")} strokeWidth={1.8} />
                          </PressableScale>
                        );
                      })}
                    </View>
                    {!data.channels.length ? (
                      <Txt tone="muted">No channels are available yet.</Txt>
                    ) : null}
                  </View>
                </>
              ) : null}

              {data.viewer?.canApproveJoinRequests && data.pendingJoinRequests?.length ? (
                <View
                  style={{
                    gap: spacing.sm,
                    borderRadius: radii.lg,
                    backgroundColor: color("muted"),
                    padding: spacing.md,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                    <Txt variant="section">Join requests</Txt>
                    <Txt variant="caption" tone="muted">
                      {data.pendingJoinRequests.length}
                    </Txt>
                  </View>
                  {data.pendingJoinRequests.map((request: any, index: number) => {
                    const requesterName = [request.requester?.firstName, request.requester?.lastName].filter(Boolean).join(" ") || "Community member";
                    return (
                      <View
                        key={request._id}
                        style={{
                          gap: spacing.sm,
                          paddingTop: spacing.sm,
                          paddingBottom: index === data.pendingJoinRequests.length - 1 ? 0 : spacing.md,
                          borderBottomWidth: index === data.pendingJoinRequests.length - 1 ? 0 : 1,
                          borderBottomColor: color("border"),
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                          <Avatar uri={request.requester?.avatarUrl} name={requesterName} size={36} />
                          <View style={{ flex: 1 }}>
                            <Txt style={{ fontWeight: "700" }} numberOfLines={1}>
                              {requesterName}
                            </Txt>
                            <Txt variant="caption" tone="muted" numberOfLines={1}>
                              {request.requester?.uniqueId}
                            </Txt>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <Button
                            title="Approve"
                            size="sm"
                            style={{ flex: 1 }}
                            onPress={() =>
                              respondToJoinRequest({ clubId: clubId as any, requestId: request._id, accept: true }).catch(
                                (error) => Alert.alert("Could not approve", error instanceof Error ? error.message : "Try again."),
                              )
                            }
                          />
                          <Button
                            title="Decline"
                            size="sm"
                            variant="ghost"
                            style={{ flex: 1 }}
                            onPress={() =>
                              respondToJoinRequest({ clubId: clubId as any, requestId: request._id, accept: false }).catch(
                                (error) => Alert.alert("Could not decline", error instanceof Error ? error.message : "Try again."),
                              )
                            }
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}
