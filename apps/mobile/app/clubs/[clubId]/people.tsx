import { useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ellipsis, Ticket, Trash2, UserPlus } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Avatar, Button, IconButton, TextField, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubPeopleScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const club = useQuery(api.clubs.detail.get, clubId ? { clubId: clubId as any } : "skip");
  const sendInvite = useMutation(api.clubs.invitations.sendInvite);
  const generateJoinCode = useMutation(api.clubs.invitations.generateJoinCode);
  const setMemberRole = useMutation(api.clubs.management.setMemberRole);
  const removeMember = useMutation(api.clubs.management.removeMember);
  const respondToJoinRequest = useMutation(api.clubs.invitations.respondToJoinRequest);
  const [inviteId, setInviteId] = useState("");
  const [managingId, setManagingId] = useState<string | null>(null);
  const { color } = useTheme();

  return (
    <Screen title="People">
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data: any) => (
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.xl }}>
            <Txt variant="label" tone="muted">
              {data.name} · {data.directory?.length ?? 0} {(data.directory?.length ?? 0) === 1 ? "person" : "people"}
            </Txt>

            {data.viewer?.canManageMembership ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <UserPlus size={19} color={color("foreground")} strokeWidth={1.9} />
                  <Txt variant="section">Invite member</Txt>
                </View>
                <TextField
                  value={inviteId}
                  onChangeText={setInviteId}
                  placeholder="School ID"
                  accessibilityLabel="Student ID"
                  autoCapitalize="characters"
                  returnKeyType="send"
                />
                <Button
                  title="Send invite"
                  disabled={!inviteId.trim()}
                  onPress={() =>
                    sendInvite({ clubId: clubId as any, recipientUniqueId: inviteId.trim() })
                      .then(() => {
                        setInviteId("");
                        Alert.alert("Invite sent");
                      })
                      .catch((error) => Alert.alert("Invite failed", error instanceof Error ? error.message : "Try again."))
                  }
                />

                <View
                  style={{
                    borderRadius: radii.lg,
                    backgroundColor: color("muted"),
                    padding: spacing.md,
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
                    <Ticket size={19} color={color("foreground")} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Txt variant="caption" tone="muted">
                      Join code
                    </Txt>
                    <Txt
                      variant="section"
                      style={{ letterSpacing: data.activeJoinCode ? 1.6 : 0 }}
                      numberOfLines={1}
                    >
                      {data.activeJoinCode?.code ?? "Not created"}
                    </Txt>
                  </View>
                  <Button
                    title={data.activeJoinCode ? "Replace" : "Create"}
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      generateJoinCode({ clubId: clubId as any })
                        .then((code) => Alert.alert("Join code", String(code)))
                        .catch((error) => Alert.alert("Join code failed", error instanceof Error ? error.message : "Try again."))
                    }
                  />
                </View>
              </View>
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

            <View style={{ gap: spacing.sm }}>
              <Txt variant="section">Directory</Txt>
              <View>
                {(data.directory ?? []).map((person: any, index: number) => {
                  const name = [person.firstName, person.lastName].filter(Boolean).join(" ") || "Member";
                  const role = person.kind === "SPONSOR" ? "Sponsor" : person.clubRole === "LEADER" ? "Leader" : "Member";
                  const canManagePerson = data.viewer?.canManageMembership && person.kind === "MEMBER";
                  const isManaging = managingId === person._id;

                  return (
                    <View
                      key={`${person.kind}-${person._id}`}
                      style={{
                        gap: spacing.sm,
                        paddingVertical: spacing.md,
                        borderBottomWidth: index === data.directory.length - 1 ? 0 : 1,
                        borderBottomColor: color("border"),
                      }}
                    >
                      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                        <Avatar uri={person.avatarUrl} name={name} size={42} />
                        <View style={{ flex: 1, gap: spacing.xs }}>
                          <Txt style={{ fontWeight: "700" }} numberOfLines={1}>
                            {name}
                          </Txt>
                          <Txt variant="caption" tone="muted" numberOfLines={1}>
                            {role}{person.uniqueId ? ` · ${person.uniqueId}` : ""}
                          </Txt>
                        </View>
                        {canManagePerson ? (
                          <IconButton
                            icon={Ellipsis}
                            label={`${isManaging ? "Close controls for" : "Manage"} ${name}`}
                            size="sm"
                            variant="ghost"
                            onPress={() => setManagingId(isManaging ? null : person._id)}
                          />
                        ) : null}
                      </View>

                      {isManaging ? (
                        <View style={{ gap: spacing.sm, paddingLeft: 54 }}>
                          <Txt variant="caption" tone="muted">
                            Club role
                          </Txt>
                          <View style={{ flexDirection: "row", gap: spacing.sm }}>
                            <Button
                              title="Member"
                              size="sm"
                              style={{ flex: 1 }}
                              variant={person.clubRole === "LEADER" ? "secondary" : "primary"}
                              onPress={() =>
                                setMemberRole({ clubId: clubId as any, memberId: person._id, role: "MEMBER" }).catch((error) =>
                                  Alert.alert("Role not updated", error instanceof Error ? error.message : "Try again."),
                                )
                              }
                            />
                            <Button
                              title="Leader"
                              size="sm"
                              style={{ flex: 1 }}
                              variant={person.clubRole === "LEADER" ? "primary" : "secondary"}
                              onPress={() =>
                                setMemberRole({ clubId: clubId as any, memberId: person._id, role: "LEADER" }).catch((error) =>
                                  Alert.alert("Role not updated", error instanceof Error ? error.message : "Try again."),
                                )
                              }
                            />
                            <IconButton
                              icon={Trash2}
                              label={`Remove ${name} from club`}
                              size="sm"
                              variant="destructive"
                              onPress={() =>
                                Alert.alert("Remove member?", `${name} will lose access to this club.`, [
                                  { text: "Keep member", style: "cancel" },
                                  {
                                    text: "Remove",
                                    style: "destructive",
                                    onPress: () =>
                                      removeMember({ clubId: clubId as any, memberId: person._id })
                                        .then(() => setManagingId(null))
                                        .catch((error) =>
                                          Alert.alert("Member not removed", error instanceof Error ? error.message : "Try again."),
                                        ),
                                  },
                                ])
                              }
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              {!data.directory?.length ? <Txt tone="muted">No members yet.</Txt> : null}
            </View>
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
