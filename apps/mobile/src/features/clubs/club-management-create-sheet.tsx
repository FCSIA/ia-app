import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@/lib/convex-react";
import { Button, Sheet, TextField, useToast } from "@/components/ui";
import {
  ClubFormField,
  JoinPolicyControl,
  MemberLimitField,
  parseMemberLimit,
  type ClubJoinPolicy,
} from "@/features/clubs/club-management-controls";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

type CreateClubSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateClubSheet({ open, onClose }: CreateClubSheetProps) {
  const createClub = useMutation(api.clubs.management.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<ClubJoinPolicy>("OPEN");
  const [memberLimit, setMemberLimit] = useState("40");
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();
  const parsedMemberLimit = parseMemberLimit(memberLimit);
  const canSubmit = !!name.trim() && parsedMemberLimit !== null && !creating;

  function reset() {
    setName("");
    setDescription("");
    setJoinPolicy("OPEN");
    setMemberLimit("40");
  }

  function close() {
    if (creating) return;
    reset();
    onClose();
  }

  async function submit() {
    if (!canSubmit || parsedMemberLimit === null) return;
    setCreating(true);
    try {
      const clubId = await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        joinPolicy,
        memberLimit: parsedMemberLimit,
      });
      reset();
      onClose();
      showToast({ title: "Club created", tone: "success" });
      router.push(`/clubs/${clubId}` as never);
    } catch (error) {
      showToast({
        title: "Club wasn't created",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Create club" snapPoints={["78%", "92%"]}>
      <ClubFormField label="Name">
        <TextField
          accessibilityLabel="Club name"
          autoCapitalize="words"
          autoFocus
          maxLength={80}
          placeholder="Robotics Club"
          returnKeyType="next"
          value={name}
          onChangeText={setName}
        />
      </ClubFormField>

      <ClubFormField label="Description" hint="Optional">
        <TextField
          accessibilityLabel="Club description"
          maxLength={240}
          multiline
          numberOfLines={3}
          placeholder="A quick summary for the club directory"
          value={description}
          onChangeText={setDescription}
          style={{ minHeight: 84 }}
        />
      </ClubFormField>

      <JoinPolicyControl value={joinPolicy} onChange={setJoinPolicy} />
      <MemberLimitField value={memberLimit} onChange={setMemberLimit} />

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button
          title="Cancel"
          variant="ghost"
          style={{ flex: 1 }}
          disabled={creating}
          onPress={close}
        />
        <Button
          title="Create"
          style={{ flex: 1 }}
          loading={creating}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}
