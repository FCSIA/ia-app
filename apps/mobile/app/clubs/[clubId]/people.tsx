import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/lib/theme";
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
  const { color } = useTheme();

  return (
    <Screen title="People" subtitle="Members, sponsors, invites, join requests, and join codes.">
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data: any) => (
          <View style={{ gap: 12 }}>
            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 20, fontWeight: "900" }}>{data.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={`${data.directory?.length ?? 0} people`} color="blue" />
                {data.viewer?.canManageMembership ? <Badge label="Can manage" color="emerald" /> : null}
              </View>
            </Card>

            {data.viewer?.canManageMembership ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Invite & Join Code</Text>
                <TextField value={inviteId} onChangeText={setInviteId} placeholder="Student unique ID, e.g. STU001" autoCapitalize="characters" />
                <Button
                  title="Send invite"
                  disabled={!inviteId.trim()}
                  onPress={() =>
                    sendInvite({ clubId: clubId as any, recipientUniqueId: inviteId.trim() }).then(() => {
                      setInviteId("");
                      Alert.alert("Invite sent");
                    }).catch((error) => Alert.alert("Invite failed", error instanceof Error ? error.message : "Try again."))
                  }
                />
                {data.activeJoinCode ? (
                  <Text style={{ color: color("foreground"), fontWeight: "900" }}>Current code: {data.activeJoinCode.code}</Text>
                ) : null}
                <Button
                  title="Generate new join code"
                  variant="secondary"
                  onPress={() =>
                    generateJoinCode({ clubId: clubId as any }).then((code) => Alert.alert("Join code", String(code))).catch((error) =>
                      Alert.alert("Join code failed", error instanceof Error ? error.message : "Try again."),
                    )
                  }
                />
              </Card>
            ) : null}

            {data.viewer?.canApproveJoinRequests && data.pendingJoinRequests?.length ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Join Requests</Text>
                {data.pendingJoinRequests.map((request: any) => (
                  <View key={request._id} style={{ gap: 8 }}>
                    <Text style={{ color: color("foreground"), fontWeight: "900" }}>
                      {request.requester.firstName} {request.requester.lastName}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button title="Approve" size="sm" onPress={() => respondToJoinRequest({ clubId: clubId as any, requestId: request._id, accept: true })} />
                      <Button title="Decline" size="sm" variant="tertiary" onPress={() => respondToJoinRequest({ clubId: clubId as any, requestId: request._id, accept: false })} />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Directory</Text>
              {(data.directory ?? []).map((person: any) => (
                <View key={`${person.kind}-${person._id}`} style={{ gap: 7, paddingVertical: 5 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={person.kind} color={person.kind === "SPONSOR" ? "orange" : "gray"} />
                    {person.clubRole ? <Badge label={person.clubRole} color="blue" /> : null}
                  </View>
                  <Text style={{ color: color("foreground"), fontWeight: "900" }}>
                    {person.firstName} {person.lastName}
                  </Text>
                  <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{person.uniqueId}</Text>
                  {data.viewer?.canManageMembership && person.kind === "MEMBER" ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Button title="Member" size="sm" variant="secondary" onPress={() => setMemberRole({ clubId: clubId as any, memberId: person._id, role: "MEMBER" })} />
                      <Button title="Leader" size="sm" variant="secondary" onPress={() => setMemberRole({ clubId: clubId as any, memberId: person._id, role: "LEADER" })} />
                      <Button title="Remove" size="sm" variant="tertiary" onPress={() => removeMember({ clubId: clubId as any, memberId: person._id })} />
                    </View>
                  ) : null}
                </View>
              ))}
            </Card>
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
