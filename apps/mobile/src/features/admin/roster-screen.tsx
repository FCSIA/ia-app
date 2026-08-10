import { useState } from "react";
import { Alert, View } from "react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileWarning,
  KeyRound,
  ShieldAlert,
  Upload,
} from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import {
  Button,
  Card,
  Empty,
  Section,
  Txt,
  useToast,
} from "@/components/ui";
import {
  buildCredentialsCsv,
  buildStudentExportCsv,
  MAX_STUDENT_IMPORT_ROWS,
  parseStudentCsv,
  type StudentCsvPreview,
} from "@/features/admin/roster-csv";
import {
  datedCsvName,
  pickCsvFile,
  shareCsv,
} from "@/features/admin/roster-file-sharing";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

type ImportResult = FunctionReturnType<typeof api.users.admin.importStudents>;
type SelectedCsv = {
  name: string;
  size: number;
  preview: StudentCsvPreview;
};

export function RosterScreen() {
  const { color } = useTheme();
  const { showToast } = useToast();
  const [selectedCsv, setSelectedCsv] = useState<SelectedCsv | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState<"pick" | "import" | "export" | "credentials" | null>(null);

  const importStudents = useAction(api.users.admin.importStudents);
  const exportRows = useQuery(api.users.admin.exportStudents, {});
  const canImport = !!selectedCsv
    && selectedCsv.preview.rows.length > 0
    && selectedCsv.preview.blockingIssues.length === 0;

  async function chooseCsv() {
    setPending("pick");
    try {
      const file = await pickCsvFile();
      if (!file) return;
      const preview = parseStudentCsv(file.text);
      setSelectedCsv({ name: file.name, size: file.size, preview });
      setLastImport(null);
      if (preview.blockingIssues.length) {
        showToast({
          title: "CSV needs attention",
          body: preview.blockingIssues[0]?.message,
          tone: "warning",
        });
      }
    } catch (error) {
      showToast({
        title: "Could not open CSV",
        body: error instanceof Error ? error.message : "Choose the file again.",
        tone: "warning",
      });
    } finally {
      setPending(null);
    }
  }

  function confirmImport() {
    if (!selectedCsv || !canImport || pending) return;
    const { rows, invalidRows } = selectedCsv.preview;
    const invalidCopy = invalidRows
      ? ` ${invalidRows} invalid ${invalidRows === 1 ? "row is" : "rows are"} excluded.`
      : "";
    const sharingNotice =
      " A separate credentials CSV will open in the share sheet. Share it only through an approved school channel.";

    Alert.alert(
      `Create ${rows.length} ${rows.length === 1 ? "account" : "accounts"}?`,
      `This creates live student accounts.${invalidCopy} Existing student IDs are skipped and never overwritten.${sharingNotice}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Import", onPress: () => void performImport() },
      ],
    );
  }

  async function performImport() {
    if (!selectedCsv || !canImport || pending) return;
    setPending("import");
    try {
      const result = await importStudents({
        rows: selectedCsv.preview.rows,
      });
      setLastImport(result);
      setSelectedCsv(null);

      let credentialsShareFailed = false;
      if (result.generatedCredentials.length) {
        try {
          await shareCredentials(result.generatedCredentials);
        } catch {
          credentialsShareFailed = true;
        }
      }

      showToast({
        title: `${result.created} ${result.created === 1 ? "student" : "students"} created`,
        body: credentialsShareFailed
          ? "Accounts were created, but the credentials CSV was not shared. Use Share credentials below."
          : `${result.skipped} skipped${result.generatedCredentials.length ? " · credentials ready" : ""}`,
        tone: credentialsShareFailed ? "warning" : "success",
      });
    } catch (error) {
      showToast({
        title: "Import failed",
        body: error instanceof Error ? error.message : "No accounts were imported. Try again.",
        tone: "warning",
      });
    } finally {
      setPending(null);
    }
  }

  async function exportStudents() {
    if (!exportRows?.length || pending) return;
    setPending("export");
    try {
      await shareCsv({
        fileName: datedCsvName("student-roster"),
        contents: buildStudentExportCsv(exportRows),
        dialogTitle: "Share student roster",
      });
      showToast({ title: "Student roster ready", tone: "success" });
    } catch (error) {
      showToast({
        title: "Export failed",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setPending(null);
    }
  }

  async function shareCredentialsAgain() {
    if (!lastImport?.generatedCredentials.length || pending) return;
    setPending("credentials");
    try {
      await shareCredentials(lastImport.generatedCredentials);
      showToast({ title: "Credentials ready to share", tone: "success" });
    } catch (error) {
      showToast({
        title: "Could not share credentials",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen
      header={<AppHeader title="Student roster" />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Import CSV">
        <View style={{ gap: spacing.sm }}>
          <Txt variant="body" tone="muted">
            Required columns: first name, last name, student ID. Email, grade, major pathway, and minor pathway are optional.
          </Txt>
          <Txt variant="caption" tone="muted">
            Pathways: IT, Health Science, or Engineering · Up to {MAX_STUDENT_IMPORT_ROWS} rows
          </Txt>
        </View>

        <Button
          title={selectedCsv ? "Choose another CSV" : "Choose CSV from Files"}
          variant="secondary"
          icon={Upload}
          loading={pending === "pick"}
          disabled={pending != null && pending !== "pick"}
          onPress={() => void chooseCsv()}
        />

        {selectedCsv ? <CsvPreview selected={selectedCsv} /> : (
          <Empty
            title="No CSV selected"
            body="Choose a roster file to review every row before anything is imported."
            icon={FileSpreadsheet}
          />
        )}

        <Card variant="flat" style={{ gap: spacing.sm }}>
          <Txt variant="label">Random temporary passwords</Txt>
          <Txt variant="caption" tone="muted">
            A separate credentials CSV opens after import.
          </Txt>
          <Txt variant="caption" tone="destructive">
            Temporary passwords are sensitive. Do not send the credentials file through personal email or chat.
          </Txt>
        </Card>

        <Button
          title={selectedCsv?.preview.rows.length
            ? `Import ${selectedCsv.preview.rows.length} valid ${selectedCsv.preview.rows.length === 1 ? "row" : "rows"}`
            : "Import students"}
          icon={Upload}
          loading={pending === "import"}
          disabled={!canImport || pending != null}
          onPress={confirmImport}
        />
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: color("border"),
            padding: spacing.md,
          }}
        >
          <ShieldAlert size={19} color={color("destructive")} />
          <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
            Importing creates live accounts. Invalid rows are never sent; existing student IDs are skipped without changing those accounts.
          </Txt>
        </View>
      </Section>

      {lastImport ? (
        <Section title="Last import">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Metric value={lastImport.created} label="Created" />
            <Metric value={lastImport.skipped} label="Skipped" />
            <Metric value={lastImport.generatedCredentials.length} label="Passwords" />
          </View>

          {lastImport.errors.length ? (
            <IssueList
              title="Server-skipped rows"
              issues={lastImport.errors.map((message) => ({ message }))}
            />
          ) : null}

          {lastImport.generatedCredentials.length ? (
            <>
              <Button
                title="Share credentials"
                icon={KeyRound}
                loading={pending === "credentials"}
                disabled={pending != null}
                onPress={() => void shareCredentialsAgain()}
              />
              <Txt variant="caption" tone="destructive">
                Passwords remain only in this screen’s memory. The temporary share file is deleted after the share sheet closes.
              </Txt>
            </>
          ) : null}

          <Button
            title="Clear import result"
            variant="ghost"
            disabled={pending != null}
            onPress={() => setLastImport(null)}
          />
        </Section>
      ) : null}

      <Section title="Export roster">
        <Txt variant="body" tone="muted">
          Share a current CSV of all student accounts, including IDs, emails, grades, and pathways.
        </Txt>
        {exportRows === undefined ? (
          <Empty title="Loading student roster…" icon={FileSpreadsheet} />
        ) : exportRows.length === 0 ? (
          <Empty
            title="No students to export"
            body="Student accounts will appear here after they are created."
            icon={FileWarning}
          />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.xs }}>
            <Txt variant="title">{exportRows.length}</Txt>
            <Txt variant="caption" tone="muted">
              {exportRows.length === 1 ? "student" : "students"}
            </Txt>
          </View>
        )}
        <Button
          title="Share student CSV"
          variant="secondary"
          icon={Download}
          loading={pending === "export"}
          disabled={!exportRows?.length || pending != null}
          onPress={() => void exportStudents()}
        />
        <Txt variant="caption" tone="destructive">
          The export contains student records. Save it only to approved school storage and delete unneeded copies.
        </Txt>
      </Section>
    </Screen>
  );
}

function CsvPreview({ selected }: { selected: SelectedCsv }) {
  const { color } = useTheme();
  const { preview } = selected;

  return (
    <View style={{ gap: spacing.md }}>
      <Card variant="flat" style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {preview.blockingIssues.length
            ? <FileWarning size={20} color={color("destructive")} />
            : <FileCheck2 size={20} color={color("primary")} />}
          <View style={{ flex: 1 }}>
            <Txt variant="label" numberOfLines={1}>{selected.name}</Txt>
            <Txt variant="caption" tone="muted">{formatBytes(selected.size)}</Txt>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Metric value={preview.totalRows} label="Rows" />
        <Metric value={preview.rows.length} label="Valid" />
        <Metric value={preview.invalidRows} label="Invalid" />
      </View>

      {preview.issues.length ? (
        <IssueList title="Fix before importing" issues={preview.issues} />
      ) : (
        <Txt variant="caption" tone="muted">
          All rows passed local validation. Existing IDs are checked by the server during import.
        </Txt>
      )}
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: radii.md,
        backgroundColor: color("secondary"),
        padding: spacing.sm,
        gap: 1,
      }}
    >
      <Txt variant="section" numberOfLines={1}>{value}</Txt>
      <Txt variant="caption" tone="muted" numberOfLines={1}>{label}</Txt>
    </View>
  );
}

function IssueList({
  title,
  issues,
}: {
  title: string;
  issues: readonly { row?: number; message: string }[];
}) {
  const visible = issues.slice(0, 5);
  const remaining = issues.length - visible.length;

  return (
    <View style={{ gap: spacing.xs }}>
      <Txt variant="label" tone="destructive">{title}</Txt>
      {visible.map((issue, index) => (
        <Txt key={`${issue.row ?? "server"}-${index}-${issue.message}`} variant="caption" tone="muted">
          {issue.row ? `Row ${issue.row} · ` : ""}{issue.message}
        </Txt>
      ))}
      {remaining > 0 ? (
        <Txt variant="caption" tone="muted">And {remaining} more {remaining === 1 ? "error" : "errors"}.</Txt>
      ) : null}
    </View>
  );
}

async function shareCredentials(credentials: ImportResult["generatedCredentials"]) {
  await shareCsv({
    fileName: datedCsvName("student-temporary-passwords"),
    contents: buildCredentialsCsv(credentials),
    dialogTitle: "Share temporary student passwords",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}
