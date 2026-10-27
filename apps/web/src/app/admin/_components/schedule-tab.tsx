'use client';

import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { RosterCsvPreview } from '../_lib/roster-csv';
import type {
  StudentBulkUpdateResult,
  StudentImportResult,
} from '../_lib/types';
import { AdminPanel } from './admin-ui';
import {
  RosterCsvHelp,
  RosterCsvReview,
  RosterImportResult,
  RosterUpdateResult,
} from './roster-csv-review';

export function AdminScheduleTab({
  studentCsvInputKey,
  onStudentCsvFileChange,
  canImport,
  isImporting,
  onImport,
  isExporting,
  canExport,
  onExport,
  lastStudentImport,
  onExportGeneratedPasswords,
  isUpdating,
  onBulkUpdate,
  lastStudentUpdate,
  fileName,
  isReading,
  fileError,
  clearFile,
  preview,
  mode,
  onModeChange,
}: {
  studentCsvInputKey: number;
  onStudentCsvFileChange: (file: File | null) => void;
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
  isExporting: boolean;
  canExport: boolean;
  onExport: () => void;
  lastStudentImport: StudentImportResult | null;
  onExportGeneratedPasswords: () => void;
  isUpdating: boolean;
  onBulkUpdate: () => void;
  lastStudentUpdate: StudentBulkUpdateResult | null;
  fileName?: string;
  isReading: boolean;
  fileError?: string;
  clearFile: () => void;
  preview: RosterCsvPreview<unknown> | null;
  mode: 'import' | 'update';
  onModeChange: (mode: 'import' | 'update') => void;
}) {
  const busy = isImporting || isUpdating;
  const updating = mode === 'update';
  const count = preview?.rows.length ?? 0;
  const studentLabel = count === 1 ? 'student' : 'students';
  return (
    <div className="space-y-4">
      <AdminPanel
        title="Student roster"
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={onExport}
            loading={isExporting}
            disabled={!canExport}
            leadingIcon={Download}
          >
            Export CSV
          </Button>
        }
        contentClassName="space-y-4"
      >
        <p className="text-sm text-muted-foreground">
          Choose a CSV to validate and review before changing student records.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={mode}
            disabled={busy}
            onValueChange={(value) =>
              onModeChange(value as 'import' | 'update')
            }
          >
            <SelectTrigger
              aria-label="Roster operation"
              className="w-full sm:w-56"
            />
            <SelectContent>
              <SelectItem value="import" index={0}>
                Import new students
              </SelectItem>
              <SelectItem value="update" index={1}>
                Update existing students
              </SelectItem>
            </SelectContent>
          </Select>
          <FileInput
            key={studentCsvInputKey}
            accept=".csv,text/csv"
            label={fileName ? 'Replace CSV' : 'Choose CSV'}
            onFileSelect={onStudentCsvFileChange}
            disabled={busy}
            loading={isReading}
          />
          {fileName ? (
            <>
              <span className="min-w-0 break-all text-sm text-muted-foreground">
                {fileName}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={clearFile}
              >
                Clear file
              </Button>
            </>
          ) : null}
        </div>
        {fileError ? (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        ) : null}
        {preview ? (
          <div className="space-y-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  leadingIcon={Upload}
                  disabled={!canImport || busy}
                  loading={busy}
                >
                  Review {updating ? 'update' : 'import'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {updating ? 'Update' : 'Import'} {count} student {count === 1 ? 'record' : 'records'}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {updating
                      ? `Update records from ${fileName}. Only grade, major, and minor columns included in this CSV change; blanks clear those fields. Names, email addresses, and other columns are not updated. This cannot be undone here.`
                      : `Import ${count} rows from ${fileName}. Existing student IDs will be skipped. New students receive temporary passwords to export after import.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!canImport || busy}
                    onClick={updating ? onBulkUpdate : onImport}
                  >
                    {updating ? 'Update' : 'Import'} {count} {studentLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground">
              {canImport
                ? 'File validation passed. Existing accounts and record conflicts are checked when submitted.'
                : 'Correct the validation errors below, then replace this CSV.'}
            </p>
          </div>
        ) : null}
        <RosterCsvHelp>
          <p>
            Up to 200 rows. Use a header row. Grades must be whole numbers from
            9 to 12; pathways are IT, Health Science, or Engineering. A minor
            must differ from the major.
          </p>
          {updating ? (
            <>
              <p>
                Include student_id and only the columns to change. A blank in an
                included column clears that field. Fields outside this CSV stay
                unchanged.
              </p>
              <pre className="overflow-x-auto font-mono text-xs">
                <code>
                  {
                    'student_id,major_pathway,minor_pathway\nSTU001,Engineering,\nSTU002,Engineering,Health Science'
                  }
                </code>
              </pre>
            </>
          ) : (
            <>
              <p>
                First name, last name, and student ID are required. Email,
                grade, major, and minor are optional. Existing IDs are skipped.
              </p>
              <pre className="overflow-x-auto font-mono text-xs">
                <code>
                  {
                    'first_name,last_name,student_id,email,grade_level,major_pathway,minor_pathway\nAlex,Smith,STU001,alex.smith@example.com,10,IT,'
                  }
                </code>
              </pre>
              <p>
                New students receive temporary passwords. Export them
                immediately after import.
              </p>
            </>
          )}
        </RosterCsvHelp>
      </AdminPanel>
      {preview ? (
        <RosterCsvReview preview={preview} clearsBlanks={updating} />
      ) : null}
      {lastStudentImport ? (
        <RosterImportResult
          result={lastStudentImport}
          onExportPasswords={onExportGeneratedPasswords}
        />
      ) : null}
      {lastStudentUpdate ? (
        <RosterUpdateResult result={lastStudentUpdate} />
      ) : null}
    </div>
  );
}
