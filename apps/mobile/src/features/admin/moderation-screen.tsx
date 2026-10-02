import { displayName } from '~/apps/shared/user-name';
import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useMutation, useQuery } from "@/lib/convex-react";
import type { FunctionReturnType } from "convex/server";
import { Flag, Plus, ShieldAlert, Trash2 } from "lucide-react-native";
import { Screen } from "@/components/screen";
import {
  Badge,
  Button,
  Empty,
  IconButton,
  PressableScale,
  Section,
  SegmentedControl,
  Sheet,
  SkeletonList,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

type Report = FunctionReturnType<typeof api.moderation.reports.list>[number];
type ReportStatus = Report["status"];

const statuses = [
  { label: "Pending", value: "PENDING" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Dismissed", value: "DISMISSED" },
] as const;

export function ModerationScreen() {
  const [status, setStatus] = useState<ReportStatus>("PENDING");
  const [selectedId, setSelectedId] = useState<Id<"moderationReports"> | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [updatingId, setUpdatingId] = useState<Id<"moderationReports"> | null>(null);
  const reports = useQuery(api.moderation.reports.list, { status });
  const updateReport = useMutation(api.moderation.reports.update);
  const { showToast } = useToast();
  const selectedReport = reports?.find((report) => report._id === selectedId) ?? null;

  function openReport(report: Report) {
    setSelectedId(report._id);
    setReviewNote(report.reviewNote ?? "");
  }

  function closeReport() {
    if (updatingId) return;
    setSelectedId(null);
    setReviewNote("");
  }

  async function submitReview(nextStatus: Extract<ReportStatus, "RESOLVED" | "DISMISSED">) {
    if (!selectedReport || !reviewNote.trim() || updatingId) return;
    setUpdatingId(selectedReport._id);
    try {
      await updateReport({
        reportId: selectedReport._id,
        status: nextStatus,
        reviewNote: reviewNote.trim(),
      });
      showToast({
        title: nextStatus === "RESOLVED" ? "Report resolved" : "Report dismissed",
        tone: "success",
      });
      setSelectedId(null);
      setReviewNote("");
    } catch (error) {
      showToast({
        title: "Report wasn't updated",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  function confirmDismiss() {
    if (!reviewNote.trim()) return;
    Alert.alert(
      "Dismiss this report?",
      "It will leave the pending queue with your review note attached.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Dismiss", style: "destructive", onPress: () => void submitReview("DISMISSED") },
      ],
    );
  }

  return (
    <Screen title="Moderation">
      <SegmentedControl segments={statuses} value={status} onChange={setStatus} />

      <Section title="Reports">
        {reports === undefined ? (
          <SkeletonList count={4} />
        ) : reports.length === 0 ? (
          <Empty
            icon={Flag}
            title={`No ${status.toLowerCase()} reports`}
            body={status === "PENDING" ? "The review queue is clear." : undefined}
          />
        ) : (
          <ReportList reports={reports} onOpen={openReport} />
        )}
      </Section>

      <KeywordRules />

      <Sheet open={!!selectedReport} onClose={closeReport} title="Review report" snapPoints={["72%", "90%"]}>
        {selectedReport ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Badge label={humanize(selectedReport.contentType)} variant="dot" />
                {selectedReport.isEscalated ? <Badge label="Escalated" color="amber" /> : null}
              </View>
              <Txt variant="section">{selectedReport.reason}</Txt>
              <Txt variant="caption" tone="muted">
                {reportContext(selectedReport)}
              </Txt>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Txt variant="label">Review note</Txt>
              <TextField
                accessibilityLabel="Review note"
                editable={!updatingId && selectedReport.status === "PENDING"}
                multiline
                numberOfLines={4}
                placeholder="Record what you reviewed and why"
                value={reviewNote}
                onChangeText={setReviewNote}
                style={{ minHeight: 104 }}
              />
              {selectedReport.status === "PENDING" ? (
                <Txt variant="caption" tone={reviewNote.trim() ? "muted" : "destructive"}>
                  A note is required before closing a report.
                </Txt>
              ) : null}
            </View>

            {selectedReport.status === "PENDING" ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  title="Resolve"
                  style={{ flex: 1 }}
                  loading={updatingId === selectedReport._id}
                  disabled={!reviewNote.trim()}
                  onPress={() => void submitReview("RESOLVED")}
                />
                <Button
                  title="Dismiss"
                  variant="tertiary"
                  style={{ flex: 1 }}
                  disabled={!reviewNote.trim() || !!updatingId}
                  onPress={confirmDismiss}
                />
              </View>
            ) : (
              <Txt variant="caption" tone="muted">
                Reviewed {formatDateTime(selectedReport.reviewedAt)}
              </Txt>
            )}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function ReportList({ reports, onOpen }: { reports: Report[]; onOpen: (report: Report) => void }) {
  const { color } = useTheme();

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: radii.lg,
        backgroundColor: color("secondary"),
      }}
    >
      {reports.map((report, index) => (
        <ButtonlessReportRow
          key={report._id}
          report={report}
          last={index === reports.length - 1}
          onPress={() => onOpen(report)}
        />
      ))}
    </View>
  );
}

function ButtonlessReportRow({ report, last, onPress }: { report: Report; last: boolean; onPress: () => void }) {
  const { color } = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Review report: ${report.reason}`}
      onPress={onPress}
      style={{
        minHeight: 74,
        justifyContent: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color("border"),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
        <Txt variant="label" numberOfLines={2} style={{ flex: 1, fontSize: 14 }}>
          {report.reason}
        </Txt>
        {report.isEscalated ? <ShieldAlert size={16} color={color("destructive")} /> : null}
      </View>
      <Txt variant="caption" tone="muted" numberOfLines={2}>
        {reportContext(report)}
      </Txt>
    </PressableScale>
  );
}

function KeywordRules() {
  const user = useLiveCurrentUser();
  const canManageRules = !!user?.roles.some((role) =>
    ["SUPPORT_STAFF", "ADMIN", "SUPER_ADMIN"].includes(role),
  );
  const rules = useQuery(api.moderation.keywords.list, canManageRules ? {} : "skip");
  const addRule = useMutation(api.moderation.keywords.add);
  const removeRule = useMutation(api.moderation.keywords.remove);
  const [keyword, setKeyword] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<Id<"moderationKeywordRules"> | null>(null);
  const { showToast } = useToast();
  const normalizedKeyword = useMemo(() => keyword.trim().toLowerCase(), [keyword]);

  if (!canManageRules) return null;

  async function addKeyword() {
    if (!normalizedKeyword || adding) return;
    setAdding(true);
    try {
      await addRule({ keyword: normalizedKeyword });
      setKeyword("");
      showToast({ title: "Safety rule added", tone: "success" });
    } catch (error) {
      showToast({
        title: "Rule wasn't added",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setAdding(false);
    }
  }

  async function removeKeyword(ruleId: Id<"moderationKeywordRules">) {
    if (removingId) return;
    setRemovingId(ruleId);
    try {
      await removeRule({ ruleId });
      showToast({ title: "Safety rule removed", tone: "success" });
    } catch (error) {
      showToast({
        title: "Rule wasn't removed",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setRemovingId(null);
    }
  }

  function confirmRemove(ruleId: Id<"moderationKeywordRules">, value: string) {
    Alert.alert("Remove safety rule?", `“${value}” will no longer be flagged by the local rule.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void removeKeyword(ruleId) },
    ]);
  }

  return (
    <Section title="Safety rules">
      <Txt variant="caption" tone="muted">
        Add local terms that should be flagged in club channels.
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <TextField
          accessibilityLabel="New safety rule"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Term or phrase"
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={() => void addKeyword()}
          style={{ flex: 1 }}
        />
        <Button
          title="Add"
          icon={Plus}
          size="sm"
          loading={adding}
          disabled={!normalizedKeyword}
          onPress={() => void addKeyword()}
        />
      </View>

      {rules === undefined ? (
        <SkeletonList count={2} />
      ) : rules.length === 0 ? (
        <Txt variant="caption" tone="muted">No local rules.</Txt>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {rules.map((rule) => (
            <View
              key={rule._id}
              style={{
                minHeight: 50,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingLeft: spacing.md,
                borderRadius: radii.md,
                backgroundColor: "transparent",
              }}
            >
              <Txt variant="body" style={{ flex: 1 }}>{rule.keyword}</Txt>
              <IconButton
                icon={Trash2}
                label={`Remove ${rule.keyword}`}
                disabled={!!removingId && removingId !== rule._id}
                onPress={() => confirmRemove(rule._id, rule.keyword)}
              />
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function reportContext(report: Report) {
  const submitter = report.submitter
    ? displayName(report.submitter)
    : "Unknown submitter";
  const target = report.reportedUser
    ? ` · Reported ${displayName(report.reportedUser)}`
    : report.club
      ? ` · ${report.club.name}`
      : "";
  return `${humanize(report.contentType)} · ${submitter}${target} · ${formatDateTime(report.createdAt)}`;
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: number | undefined) {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
