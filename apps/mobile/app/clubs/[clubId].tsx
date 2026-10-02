import { useDeferredValue, useMemo, useState } from "react";
import { displayName } from '~/apps/shared/user-name';
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@/lib/convex-react";
import {
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Search,
  Settings2,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { AppDetailHeader, Screen } from "@/components/screen";
import {
  Avatar,
  Button,
  IconButton,
  PressableScale,
  TextField,
  Txt,
} from "@/components/ui";
import { CreateEventSheet } from "@/features/calendar/create-event-sheet";
import { channelVisibilityIcon } from "@/features/clubs/channel-visibility";
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
    <Screen
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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
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
              </View>
            ) : undefined
          }
        />
      }
      contentContainerStyle={{
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.xs,
        gap: spacing.sm,
      }}
    >
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data) => {
          const hasPendingJoinRequest = !!data.viewer?.hasPendingJoinRequest;
          const canAccessWorkspace = !!data.viewer?.canAccessWorkspace;

          async function joinClub() {
            try {
              if (data.joinPolicy === "OPEN") {
                const result = await joinOpen({ clubId: clubId as any });
                if (result.kind === "memberLimitReached") {
                  Alert.alert(
                    "Club is full",
                    "A member spot must open before you can join.",
                  );
                }
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
            <View
              style={{
                width: "100%",
                maxWidth: 720,
                alignSelf: "center",
                gap: spacing.sm,
              }}
            >
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
                  <View
                    style={{
                      minHeight: 44,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        minHeight: 44,
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radii.pill,
                        backgroundColor: color("secondary"),
                      }}
                    >
                      <Search
                        size={18}
                        color={color("mutedForeground")}
                        strokeWidth={2}
                      />
                      <TextField
                        accessibilityLabel="Search club channels"
                        value={channelQuery}
                        onChangeText={setChannelQuery}
                        placeholder="Search"
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{
                          minWidth: 0,
                          minHeight: 44,
                          flex: 1,
                          borderWidth: 0,
                          backgroundColor: "transparent",
                          paddingHorizontal: 0,
                        }}
                      />
                    </View>
                    <WorkspaceIconAction
                      label="People"
                      icon={UsersRound}
                      onPress={() => router.push(`/clubs/${clubId}/people`)}
                    />
                    <WorkspaceIconAction
                      label="Shared"
                      icon={FolderOpen}
                      onPress={() =>
                        router.push(`/clubs/${clubId}/shared` as never)
                      }
                    />
                  </View>

                  <View
                    style={{
                      height: 1,
                      marginHorizontal: -spacing.sm,
                      backgroundColor: color("border"),
                    }}
                  />

                  <View style={{ gap: spacing.xs }}>
                    <PressableScale
                      accessibilityLabel={
                        channelsExpanded
                          ? "Collapse text channels"
                          : "Expand text channels"
                      }
                      accessibilityState={{ expanded: channelsExpanded }}
                      haptic={false}
                      hitSlop={2}
                      onPress={() => setChannelsExpanded((current) => !current)}
                      style={{
                        minHeight: 40,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
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
                    </PressableScale>
                    {channelsExpanded ? (
                      <>
                        <View>
                          {visibleChannels.map((channel: any) => {
                            const ChannelIcon = channelVisibilityIcon(
                              channel.visibility,
                            );

                            return (
                              <PressableScale
                                key={channel._id}
                                accessibilityLabel={`Open ${channel.name} channel`}
                                hitSlop={2}
                                onPress={() =>
                                  router.push(
                                    `/clubs/${clubId}/channels/${channel._id}`,
                                  )
                                }
                                style={{
                                  minHeight: 44,
                                  borderRadius: 8,
                                  paddingHorizontal: spacing.sm,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: spacing.sm,
                                }}
                              >
                                <View
                                  style={{
                                    width: 24,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <ChannelIcon
                                    size={20}
                                    color={color("mutedForeground")}
                                    strokeWidth={2}
                                  />
                                </View>
                                <View style={{ minWidth: 0, flex: 1 }}>
                                  <Txt
                                    tone="muted"
                                    style={{
                                      fontSize: 15,
                                      lineHeight: 20,
                                      fontWeight: "600",
                                    }}
                                    numberOfLines={1}
                                  >
                                    {channel.name}
                                  </Txt>
                                </View>
                              </PressableScale>
                            );
                          })}
                        </View>
                        {!data.channels.length ? (
                          <Txt variant="caption" tone="muted">
                            No channels yet.
                          </Txt>
                        ) : !visibleChannels.length ? (
                          <Txt variant="caption" tone="muted">
                            No channels match “{channelQuery.trim()}”.
                          </Txt>
                        ) : null}
                      </>
                    ) : null}
                  </View>
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
                      const requesterName = displayName(request.requester) || "Community member";
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
                            </View>
                          </View>
                          <View
                            style={{ flexDirection: "row", gap: spacing.sm }}
                          >
                            <Button
                              title="Approve"
                              size="sm"
                              style={{ flex: 1 }}
                              onPress={() => {
                                void respondToJoinRequest({
                                  clubId: clubId as any,
                                  requestId: request._id,
                                  accept: true,
                                })
                                  .then((result) => {
                                    if (result.kind === "memberLimitReached") {
                                      Alert.alert(
                                        "Club is full",
                                        "A member spot must open before this request can be approved.",
                                      );
                                    }
                                  })
                                  .catch((error) =>
                                    Alert.alert(
                                      "Could not approve",
                                      error instanceof Error
                                        ? error.message
                                        : "Try again.",
                                    ),
                                  );
                              }}
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
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}

function WorkspaceIconAction({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      haptic={false}
      hitSlop={2}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: radii.pill,
        backgroundColor: color("secondary"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={19} color={color("foreground")} strokeWidth={2} />
    </PressableScale>
  );
}
