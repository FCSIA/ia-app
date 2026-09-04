import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { Redirect } from "expo-router";
import { useMutation, useQuery } from "@/lib/convex-react";
import type { FunctionReturnType } from "convex/server";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-react-native";
import { Screen } from "@/components/screen";
import { Badge, Button, IconButton, Section, SkeletonList, Txt, useToast } from "@/components/ui";
import { hasRole, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

type SnapshotStatus = FunctionReturnType<typeof api.wrapped.snapshots.snapshotStatus>;
type RunKind = "missing" | "refresh";

export function WrappedOperationsScreen() {
  const user = useLiveCurrentUser();
  const currentSchoolYear = useMemo(getCurrentSchoolYear, []);
  const earliestSchoolYear = currentSchoolYear - 4;
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear);
  const [running, setRunning] = useState<RunKind | null>(null);
  const isAdmin = !!user && hasRole(user, "ADMIN", "SUPER_ADMIN");
  const status = useQuery(
    api.wrapped.snapshots.snapshotStatus,
    isAdmin ? { schoolYear } : "skip",
  );
  const generateSnapshots = useMutation(api.wrapped.snapshots.generateSnapshots);
  const { showToast } = useToast();

  if (user && !isAdmin) {
    return <Redirect href="../" />;
  }

  async function runGeneration(kind: RunKind) {
    if (running) return;
    setRunning(kind);
    try {
      const result = await generateSnapshots({
        schoolYear,
        refresh: kind === "refresh",
      });
      showToast({
        title: result.generated
          ? `${result.generated} snapshot${result.generated === 1 ? "" : "s"} generated`
          : "No snapshots generated",
        body: kind === "missing"
          ? `${result.skipped} current snapshot${result.skipped === 1 ? "" : "s"} skipped. Run again if Missing remains above zero.`
          : `Refreshed the first ${result.generated} eligible student${result.generated === 1 ? "" : "s"}.`,
        tone: result.generated ? "success" : "default",
      });
    } catch (error) {
      showToast({
        title: "Snapshot run failed",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setRunning(null);
    }
  }

  function confirmRefresh() {
    Alert.alert(
      "Refresh the first 40 snapshots?",
      `This rebuilds up to 40 existing snapshots for ${schoolYearLabel(schoolYear)}. It does not continue to later students on repeated runs.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Refresh", style: "destructive", onPress: () => void runGeneration("refresh") },
      ],
    );
  }

  return (
    <Screen title="Wrapped snapshots">
      <YearPicker
        year={schoolYear}
        earliest={earliestSchoolYear}
        latest={currentSchoolYear}
        onChange={setSchoolYear}
      />

      {status === undefined ? (
        <SkeletonList count={4} />
      ) : (
        <>
          <ReadinessSummary status={status} />

          <Section title="Generation">
            <Txt tone="muted">
              Generate missing processes up to 40 students. Run it again until Missing reaches zero.
            </Txt>
            <Button
              title="Generate missing"
              icon={Sparkles}
              loading={running === "missing"}
              disabled={!!running || status.missing === 0}
              onPress={() => void runGeneration("missing")}
            />

            <Txt variant="caption" tone="muted">
              Refresh rebuilds only the first 40 eligible students. Repeating it targets the same group; it is not a full-school refresh.
            </Txt>
            <Button
              title="Refresh first 40"
              icon={RefreshCw}
              variant="tertiary"
              loading={running === "refresh"}
              disabled={!!running || status.eligibleUsers === 0}
              onPress={confirmRefresh}
            />
          </Section>
        </>
      )}
    </Screen>
  );
}

function YearPicker({
  year,
  earliest,
  latest,
  onChange,
}: {
  year: number;
  earliest: number;
  latest: number;
  onChange: (year: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
      <IconButton
        icon={ChevronLeft}
        label="Previous school year"
        variant="ghost"
        disabled={year <= earliest}
        onPress={() => onChange(year - 1)}
      />
      <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
        <Txt variant="overline" tone="muted">School year</Txt>
        <Txt variant="section">{schoolYearLabel(year)}</Txt>
      </View>
      <IconButton
        icon={ChevronRight}
        label="Next school year"
        variant="ghost"
        disabled={year >= latest}
        onPress={() => onChange(year + 1)}
      />
    </View>
  );
}

function ReadinessSummary({ status }: { status: SnapshotStatus }) {
  const { color } = useTheme();
  const complete = status.missing === 0 && status.stale === 0;
  const coverage = status.eligibleUsers
    ? Math.round((status.generated / status.eligibleUsers) * 100)
    : 0;
  const rows = [
    { label: "Coverage", value: `${status.generated} of ${status.eligibleUsers} · ${coverage}%` },
    { label: "Missing", value: String(status.missing) },
    { label: "Stale", value: String(status.stale) },
    { label: "Schema", value: `v${status.schemaVersion}` },
    { label: "Latest run", value: formatDateTime(status.latestGeneratedAt) },
  ];

  return (
    <Section title="Readiness">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.lg,
          backgroundColor: color("secondary"),
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label">{schoolYearLabel(status.schoolYear)}</Txt>
          <Txt variant="caption" tone="muted">
            {complete ? "Every eligible student has a current snapshot." : "Generation work remains."}
          </Txt>
        </View>
        <Badge label={complete ? "Current" : "Needs work"} color={complete ? "green" : "amber"} variant="dot" />
      </View>

      <View style={{ paddingHorizontal: spacing.xs }}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
              borderBottomWidth: index === rows.length - 1 ? 0 : 1,
              borderBottomColor: color("border"),
            }}
          >
            <Txt variant="caption" tone="muted">{row.label}</Txt>
            <Txt variant="label" numberOfLines={1}>{row.value}</Txt>
          </View>
        ))}
      </View>
    </Section>
  );
}

function getCurrentSchoolYear() {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

function schoolYearLabel(startYear: number) {
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
