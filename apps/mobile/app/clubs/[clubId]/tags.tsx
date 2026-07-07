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

export default function ClubTagsScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const club = useQuery(api.clubs.detail.get, clubId ? { clubId: clubId as any } : "skip");
  const tags = useQuery(api.clubs.tags.list, clubId ? { clubId: clubId as any } : "skip");
  const createTag = useMutation(api.clubs.tags.create);
  const [name, setName] = useState("");
  const { color } = useTheme();

  return (
    <Screen title="Tags" subtitle="Mention groups for club channels.">
      <DataBoundary data={club} emptyTitle="Club unavailable">
        {(data: any) => (
          <View style={{ gap: 12 }}>
            {data.viewer?.canManageMembership ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Create Tag</Text>
                <TextField value={name} onChangeText={setName} placeholder="Tag name, e.g. Build Team" />
                <Button
                  title="Create tag"
                  disabled={!name.trim()}
                  onPress={() =>
                    createTag({ clubId: clubId as any, name, memberIds: [] }).then(() => setName("")).catch((error) =>
                      Alert.alert("Tag failed", error instanceof Error ? error.message : "Try again."),
                    )
                  }
                />
              </Card>
            ) : null}

            <DataBoundary data={tags} emptyTitle="No tags yet">
              {(items) => (
                <View style={{ gap: 12 }}>
                  {items.map((tag: any) => (
                    <Card key={tag._id} style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Badge label={`@${tag.slug}`} color="blue" />
                        <Badge label={`${tag.members?.length ?? 0} members`} color="gray" />
                      </View>
                      <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>{tag.name}</Text>
                      {tag.members?.slice(0, 8).map((member: any) => (
                        <Text key={member.user._id} style={{ color: color("mutedForeground") }}>
                          {member.user.firstName} {member.user.lastName}
                        </Text>
                      ))}
                    </Card>
                  ))}
                </View>
              )}
            </DataBoundary>
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
