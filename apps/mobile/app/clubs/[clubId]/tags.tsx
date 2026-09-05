import { useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@/lib/convex-react";
import { AtSign } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Button, TextField, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function ClubTagsScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const club = useQuery(api.clubs.detail.get, clubId ? { clubId: clubId as any } : "skip");
  const tags = useQuery(api.clubs.tags.list, clubId ? { clubId: clubId as any } : "skip");
  const createTag = useMutation(api.clubs.tags.create);
  const [name, setName] = useState("");
  const { color } = useTheme();

  return (
    <Screen title="Mention groups">
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data: any) => (
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.xl }}>
            <Txt variant="label" tone="muted">
              {data.name}
            </Txt>

            {data.viewer?.canManageMembership ? (
              <View style={{ gap: spacing.md }}>
                <Txt variant="section">New mention group</Txt>
                <TextField
                  value={name}
                  onChangeText={setName}
                  placeholder="Group name, e.g. Build Team"
                  accessibilityLabel="Mention group name"
                  returnKeyType="done"
                />
                <Button
                  title="Create group"
                  disabled={!name.trim()}
                  onPress={() =>
                    createTag({ clubId: clubId as any, name: name.trim(), memberIds: [] })
                      .then(() => setName(""))
                      .catch((error) => Alert.alert("Group not created", error instanceof Error ? error.message : "Try again."))
                  }
                />
              </View>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              <Txt variant="section">Mention groups</Txt>
              <DataBoundary data={tags} emptyTitle="No mention groups yet">
                {(items) => (
                  <View>
                    {items.map((tag: any, index: number) => {
                      const members = tag.members ?? [];
                      const memberNames = members
                        .slice(0, 5)
                        .map((member: any) => [member.user?.firstName, member.user?.lastName].filter(Boolean).join(" "))
                        .filter(Boolean);
                      const remaining = Math.max(0, members.length - memberNames.length);
                      const people = `${memberNames.join(", ")}${remaining ? ` +${remaining}` : ""}`;
                      const memberLabel = members.length
                        ? `${members.length} ${members.length === 1 ? "member" : "members"}`
                        : "No members";

                      return (
                        <View
                          key={tag._id}
                          style={{
                            minHeight: 70,
                            paddingVertical: spacing.md,
                            borderBottomWidth: index === items.length - 1 ? 0 : 1,
                            borderBottomColor: color("border"),
                            flexDirection: "row",
                            alignItems: "flex-start",
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
                            <AtSign size={19} color={color("foreground")} strokeWidth={1.9} />
                          </View>
                          <View style={{ flex: 1, gap: spacing.xs }}>
                            <Txt style={{ fontWeight: "700" }} numberOfLines={1}>
                              {tag.name}
                            </Txt>
                            <Txt variant="caption" tone="muted">
                              @{tag.slug} · {memberLabel}
                            </Txt>
                            {people ? (
                              <Txt variant="caption" tone="muted" numberOfLines={2}>
                                {people}
                              </Txt>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </DataBoundary>
            </View>
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
