import type { ReactNode } from "react";
import { View } from "react-native";
import { SegmentedControl, TextField, Txt } from "@/components/ui";
import { spacing } from "@/lib/tokens";

export type ClubJoinPolicy = "OPEN" | "REQUEST" | "INVITE_ONLY";

const joinPolicies = [
  { label: "Open", value: "OPEN" },
  { label: "Approval", value: "REQUEST" },
  { label: "Invite only", value: "INVITE_ONLY" },
] as const;

export function ClubFormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md }}>
        <Txt variant="label">{label}</Txt>
        {hint ? <Txt variant="caption" tone="muted">{hint}</Txt> : null}
      </View>
      {children}
    </View>
  );
}

export function JoinPolicyControl({
  value,
  onChange,
}: {
  value: ClubJoinPolicy;
  onChange: (value: ClubJoinPolicy) => void;
}) {
  return (
    <ClubFormField
      label="Joining"
      hint={value === "OPEN" ? "Anyone can join" : value === "REQUEST" ? "A manager approves" : "Managers send invites"}
    >
      <SegmentedControl segments={joinPolicies} value={value} onChange={onChange} />
    </ClubFormField>
  );
}

export function MemberLimitField({
  value,
  onChange,
  optional = false,
}: {
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <ClubFormField label="Member limit" hint={optional ? "Optional · 10–200" : "10–200"}>
      <TextField
        accessibilityLabel="Member limit"
        keyboardType="number-pad"
        maxLength={3}
        placeholder="40"
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, ""))}
      />
    </ClubFormField>
  );
}

export function parseMemberLimit(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 10 && parsed <= 200 ? parsed : null;
}
