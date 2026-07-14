import { useState } from "react";
import { Alert, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AtSign, ChevronRight, Trash2 } from "lucide-react-native";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Button, PressableScale, Section, TextField, Txt, useToast } from "@/components/ui";
import {
  ClubFormField,
  JoinPolicyControl,
  MemberLimitField,
  parseMemberLimit,
  type ClubJoinPolicy,
} from "@/features/clubs/club-management-controls";
import { hasRole, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

type ClubDetail = NonNullable<FunctionReturnType<typeof api.clubs.detail.get>>;

export function ClubManagementSettingsScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const detail = useQuery(
    api.clubs.detail.get,
    clubId ? { clubId: clubId as Id<"clubs"> } : "skip",
  );

  return (
    <Screen title="Club settings" keyboardShouldPersistTaps="handled">
      <DataBoundary data={detail} emptyTitle="Club unavailable">
        {(club) =>
          club.viewer?.canManageMembership ? (
            <ClubSettingsForm key={club._id} club={club} />
          ) : (
            <Redirect href={`/clubs/${club._id}` as never} />
          )
        }
      </DataBoundary>
    </Screen>
  );
}

function ClubSettingsForm({ club }: { club: ClubDetail }) {
  const updateClub = useMutation(api.clubs.management.update);
  const deactivateClub = useMutation(api.clubs.management.deactivate);
  const user = useLiveCurrentUser();
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [overview, setOverview] = useState(club.overview ?? "");
  const [joinPolicy, setJoinPolicy] = useState<ClubJoinPolicy>(club.joinPolicy);
  const [memberLimit, setMemberLimit] = useState(
    club.memberLimit === undefined ? "" : String(club.memberLimit),
  );
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const { showToast } = useToast();
  const { color } = useTheme();
  const canDeactivate = !!user && hasRole(user, "ADMIN", "SUPER_ADMIN");
  const parsedMemberLimit = memberLimit.trim() ? parseMemberLimit(memberLimit) : undefined;
  const limitIsValid = parsedMemberLimit !== null && !(club.memberLimit !== undefined && parsedMemberLimit === undefined);
  const nextName = name.trim();
  const nextDescription = description.trim();
  const nextOverview = overview.trim();
  const isDirty =
    nextName !== club.name ||
    nextDescription !== (club.description ?? "") ||
    nextOverview !== (club.overview ?? "") ||
    joinPolicy !== club.joinPolicy ||
    (parsedMemberLimit !== undefined && parsedMemberLimit !== club.memberLimit);
  const canSave = !!nextName && limitIsValid && isDirty && !saving && !deactivating;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateClub({
        clubId: club._id,
        name: nextName,
        description: nextDescription,
        overview: nextOverview,
        joinPolicy,
        ...(parsedMemberLimit === undefined ? {} : { memberLimit: parsedMemberLimit }),
      });
      showToast({ title: "Club settings saved", tone: "success" });
    } catch (error) {
      showToast({
        title: "Settings weren't saved",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!canDeactivate || deactivating) return;
    setDeactivating(true);
    try {
      await deactivateClub({ clubId: club._id });
      showToast({ title: "Club deactivated", tone: "success" });
      router.replace("/clubs" as never);
    } catch (error) {
      showToast({
        title: "Club wasn't deactivated",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setDeactivating(false);
    }
  }

  function confirmDeactivate() {
    Alert.alert(
      `Deactivate ${club.name}?`,
      "It will disappear from club lists and members will lose access. This cannot be undone in the app.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Deactivate", style: "destructive", onPress: () => void deactivate() },
      ],
    );
  }

  return (
    <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: spacing.xl }}>
      <Txt variant="label" tone="muted" numberOfLines={1}>{club.name}</Txt>

      <Section title="Details">
        <ClubFormField label="Name">
          <TextField
            accessibilityLabel="Club name"
            autoCapitalize="words"
            maxLength={80}
            value={name}
            onChangeText={setName}
          />
        </ClubFormField>
        <ClubFormField label="Description" hint="Directory summary">
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
        <ClubFormField label="Overview" hint="Club home">
          <TextField
            accessibilityLabel="Club overview"
            maxLength={1200}
            multiline
            numberOfLines={5}
            placeholder="What members should know"
            value={overview}
            onChangeText={setOverview}
            style={{ minHeight: 116 }}
          />
        </ClubFormField>
      </Section>

      <Section title="Membership">
        <JoinPolicyControl value={joinPolicy} onChange={setJoinPolicy} />
        <MemberLimitField value={memberLimit} onChange={setMemberLimit} optional />
        {!limitIsValid ? (
          <Txt variant="caption" tone="destructive">
            Use a member limit from 10 to 200.
          </Txt>
        ) : null}
      </Section>

      <Section title="Workspace">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Manage mention groups"
          onPress={() => router.push(`/clubs/${club._id}/tags` as never)}
          style={{
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <AtSign size={19} color={color("foreground")} strokeWidth={1.9} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="label">Mention groups</Txt>
            <Txt variant="caption" tone="muted">Organize groups for channel mentions</Txt>
          </View>
          <ChevronRight size={19} color={color("mutedForeground")} strokeWidth={1.8} />
        </PressableScale>
      </Section>

      <Button
        title="Save changes"
        loading={saving}
        disabled={!canSave}
        onPress={() => void save()}
      />

      {canDeactivate ? (
        <Section title="Danger zone">
          <DeactivateAction
            disabled={saving || deactivating}
            loading={deactivating}
            onPress={confirmDeactivate}
          />
        </Section>
      ) : null}
    </View>
  );
}

function DeactivateAction({
  disabled,
  loading,
  onPress,
}: {
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Deactivate club"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Trash2 size={19} color={color("destructive")} strokeWidth={1.9} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" tone="destructive">{loading ? "Deactivating…" : "Deactivate club"}</Txt>
        <Txt variant="caption" tone="muted">Remove it from active club lists</Txt>
      </View>
    </PressableScale>
  );
}
