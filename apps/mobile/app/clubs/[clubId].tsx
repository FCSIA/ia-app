import { useDeferredValue, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Hash,
  LockKeyhole,
  Megaphone,
  Settings2,
  UsersRound,
} from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { AppDetailHeader, WorkspaceScreen } from "@/components/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CompactList, CompactListItem } from "@/components/ui/compact-list";
import { CompactSearchField } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Divider, Inline, Stack } from "@/components/ui/layout";
import { Txt } from "@/components/ui/typography";
import { CreateEventSheet } from "@/features/calendar/create-event-sheet";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubDetailScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const club = useQuery(
    api.clubs.detail.get,
    clubId ? { clubId: clubId as any } : "skip",
  );
  const joinOpen = useMutation(api.clubs.invitations.joinOpenClub);
  const requestJoin = useMutation(api.clubs.invitations.requestToJoin);
  const respondToJoinRequest = useMutation(
    api.clubs.invitations.respondToJoinRequest,
  );
  const [channelQuery, setChannelQuery] = useState("");
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const deferredChannelQuery = useDeferredValue(
    channelQuery.trim().toLocaleLowerCase(),
  );
  const { color } = useTheme();
  const memberCount = club?._count?.members ?? 0;
  const visibleChannels = useMemo(() => {
    const channels = club?.channels ?? [];
    if (!deferredChannelQuery) return channels;
    return channels.filter((channel: any) =>
      `${channel.name} ${channel.description ?? ""}`
        .toLocaleLowerCase()
        .includes(deferredChannelQuery),
    );
  }, [club?.channels, deferredChannelQuery]);

  return (
    <WorkspaceScreen
      navigation={
        <AppDetailHeader
          title={club?.name ?? "Club"}
          subtitle={
            club
              ? `${memberCount} ${memberCount === 1 ? "member" : "members"}`
              : "Loading workspace…"
          }
          leading={
            club ? (
              <Avatar uri={club.logoUrl} name={club.name} size={30} />
            ) : undefined
          }
          action={
            club?.viewer?.canManageMembership ? (
              <Inline gap="xs">
                <IconButton
                  icon={CalendarPlus}
                  label="Create event"
                  size="xs"
                  variant="ghost"
                  onPress={() => setShowCreateEvent(true)}
                />
                <IconButton
                  icon={Settings2}
                  label="Club settings"
                  size="xs"
                  variant="ghost"
                  onPress={() =>
                    router.push(`/clubs/${clubId}/settings` as never)
                  }
                />
              </Inline>
            ) : undefined
          }
        />
      }
    >
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
              Alert.alert(
                "Could not join",
                error instanceof Error ? error.message : "Try again.",
              );
            }
          }

          return (
            <Stack gap="sm" className="w-full">
              {!canAccessWorkspace ? (
                <View style={{ gap: spacing.md }}>
                  {(data.overview ?? data.description) ? (
                    <Txt tone="muted">{data.overview ?? data.description}</Txt>
                  ) : null}
                  <Button
                    title={
                      hasPendingJoinRequest
                        ? "Request pending"
                        : data.joinPolicy === "OPEN"
                          ? "Join club"
                          : "Request to join"
                    }
                    disabled={hasPendingJoinRequest}
                    onPress={joinClub}
                  />
                </View>
              ) : null}

              {canAccessWorkspace ? (
                <>
                  <Inline gap="xs" className="w-full">
                    <CompactSearchField
                      accessibilityLabel="Search club channels"
                      value={channelQuery}
                      onChangeText={setChannelQuery}
                      onClear={() => setChannelQuery("")}
                      placeholder="Search"
                      returnKeyType="search"
                      autoCapitalize="none"
                      autoCorrect={false}
                      containerStyle={{ flex: 1 }}
                    />
                    <IconButton
                      label="People"
                      icon={UsersRound}
                      size="xs"
                      onPress={() => router.push(`/clubs/${clubId}/people`)}
                    />
                    <IconButton
                      label="Shared"
                      icon={FolderOpen}
                      size="xs"
                      onPress={() =>
                        router.push(`/clubs/${clubId}/shared` as never)
                      }
                    />
                  </Inline>

                  <Divider style={{ marginHorizontal: -spacing.sm }} />

                  <Collapsible
                    open={channelsExpanded}
                    onOpenChange={setChannelsExpanded}
                  >
                    <CollapsibleTrigger
                      accessibilityLabel={
                        channelsExpanded
                          ? "Collapse text channels"
                          : "Expand text channels"
                      }
                      style={{
                        gap: spacing.xs,
                        paddingHorizontal: spacing.sm,
                      }}
                    >
                      {channelsExpanded ? (
                        <ChevronDown
                          size={14}
                          color={color("mutedForeground")}
                          strokeWidth={2}
                        />
                      ) : (
                        <ChevronRight
                          size={14}
                          color={color("mutedForeground")}
                          strokeWidth={2}
                        />
                      )}
                      <Txt
                        variant="label"
                        tone="muted"
                        style={{ fontWeight: "800", fontSize: 12 }}
                      >
                        Text channels
                      </Txt>
                      <Txt
                        variant="caption"
                        tone="muted"
                        style={{ marginLeft: "auto", fontSize: 11 }}
                      >
                        {visibleChannels.length}
                      </Txt>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <>
                        <CompactList density="compact" separation="none">
                          {visibleChannels.map((channel: any) => {
                            const ChannelIcon = channelVisibilityIcon(
                              channel.visibility,
                            );

                            return (
                              <CompactListItem
                                key={channel._id}
                                accessibilityLabel={`Open ${channel.name} channel`}
                                icon={ChannelIcon}
                                title={channel.name}
                                onPress={() =>
                                  router.push(
                                    `/clubs/${clubId}/channels/${channel._id}`,
                                  )
                                }
                              />
                            );
                          })}
                        </CompactList>
                        {!data.channels.length ? (
                          <Txt
                            variant="caption"
                            tone="muted"
                            style={{ paddingHorizontal: spacing.sm }}
                          >
                            No channels yet.
                          </Txt>
                        ) : !visibleChannels.length ? (
                          <Txt
                            variant="caption"
                            tone="muted"
                            style={{ paddingHorizontal: spacing.sm }}
                          >
                            No channels match “{channelQuery.trim()}”.
                          </Txt>
                        ) : null}
                      </>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              ) : null}

              {data.viewer?.canApproveJoinRequests &&
              data.pendingJoinRequests?.length ? (
                <View
                  style={{
                    gap: spacing.sm,
                    borderRadius: radii.lg,
                    backgroundColor: color("muted"),
                    padding: spacing.md,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                    }}
                  >
                    <Txt variant="section">Join requests</Txt>
                    <Txt variant="caption" tone="muted">
                      {data.pendingJoinRequests.length}
                    </Txt>
                  </View>
                  {data.pendingJoinRequests.map(
                    (request: any, index: number) => {
                      const requesterName =
                        [
                          request.requester?.firstName,
                          request.requester?.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || "Community member";
                      return (
                        <View
                          key={request._id}
                          style={{
                            gap: spacing.sm,
                            paddingTop: spacing.sm,
                            paddingBottom:
                              index === data.pendingJoinRequests.length - 1
                                ? 0
                                : spacing.md,
                            borderBottomWidth:
                              index === data.pendingJoinRequests.length - 1
                                ? 0
                                : 1,
                            borderBottomColor: color("border"),
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing.sm,
                            }}
                          >
                            <Avatar
                              uri={request.requester?.avatarUrl}
                              name={requesterName}
                              size={36}
                            />
                            <View style={{ flex: 1 }}>
                              <Txt
                                style={{ fontWeight: "700" }}
                                numberOfLines={1}
                              >
                                {requesterName}
                              </Txt>
                              <Txt
                                variant="caption"
                                tone="muted"
                                numberOfLines={1}
                              >
                                {request.requester?.uniqueId}
                              </Txt>
                            </View>
                          </View>
                          <View
                            style={{ flexDirection: "row", gap: spacing.sm }}
                          >
                            <Button
                              title="Approve"
                              size="sm"
                              style={{ flex: 1 }}
                              onPress={() =>
                                respondToJoinRequest({
                                  clubId: clubId as any,
                                  requestId: request._id,
                                  accept: true,
                                }).catch((error) =>
                                  Alert.alert(
                                    "Could not approve",
                                    error instanceof Error
                                      ? error.message
                                      : "Try again.",
                                  ),
                                )
                              }
                            />
                            <Button
                              title="Decline"
                              size="sm"
                              variant="ghost"
                              style={{ flex: 1 }}
                              onPress={() =>
                                respondToJoinRequest({
                                  clubId: clubId as any,
                                  requestId: request._id,
                                  accept: false,
                                }).catch((error) =>
                                  Alert.alert(
                                    "Could not decline",
                                    error instanceof Error
                                      ? error.message
                                      : "Try again.",
                                  ),
                                )
                              }
                            />
                          </View>
                        </View>
                      );
                    },
                  )}
                </View>
              ) : null}

              <CreateEventSheet
                open={showCreateEvent}
                onClose={() => setShowCreateEvent(false)}
                defaultClubId={clubId}
              />
            </Stack>
          );
        }}
      </DataBoundary>
    </WorkspaceScreen>
  );
}

function channelVisibilityIcon(
  visibility: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY",
) {
  if (visibility === "PRIVATE") return LockKeyhole;
  if (visibility === "MEMBER_READONLY") return Megaphone;
  return Hash;
}
