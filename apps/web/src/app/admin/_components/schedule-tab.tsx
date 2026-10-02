'use client';

import { Download, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { StudentBulkUpdateResult, StudentImportResult } from '../_lib/types';
import { AdminMetric, AdminPanel } from './admin-ui';

const studentCsvExample = `first_name,last_name,student_id,email,grade_level,major_pathway,minor_pathway
Alex,Smith,STU001,alex.smith@example.com,10,IT,`;

const studentBulkUpdateCsvExample = `student_id,major_pathway,minor_pathway
STU001,Engineering,
STU002,Engineering,Health Science`;

export function AdminScheduleTab({
  studentCsvInputKey,
  onStudentCsvFileChange,
  canImport,
  isImporting,
  onImport,
  isExporting,
  onExport,
  lastStudentImport,
  onExportGeneratedPasswords,
  isUpdating,
  onBulkUpdate,
  lastStudentUpdate,
}: {
  studentCsvInputKey: number;
  onStudentCsvFileChange: (file: File | null) => void;
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
  isExporting: boolean;
  onExport: () => void;
  lastStudentImport: StudentImportResult | null;
  onExportGeneratedPasswords: () => void;
  isUpdating: boolean;
  onBulkUpdate: () => void;
  lastStudentUpdate: StudentBulkUpdateResult | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <AdminPanel title="Student Roster Import" contentClassName="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {['First Name', 'Last Name', 'Student ID', 'Grade Level', 'Major Pathway', 'Minor Pathway (optional)'].map((field) => (
              <Badge key={field} variant="solid" size="sm">
                {field}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Accepted pathway labels: <span className="text-foreground">IT</span>, <span className="text-foreground">Health Science</span>, <span className="text-foreground">Engineering</span>.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-foreground">Example CSV</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
            <code>{studentCsvExample}</code>
          </pre>
          <p className="text-xs text-muted-foreground">
            Use the first line as your header row. Email, grade, major, and minor are optional.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            key={studentCsvInputKey}
            type="file"
            accept=".csv"
            onChange={(event) => onStudentCsvFileChange(event.target.files?.[0] || null)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onImport}
              disabled={!canImport}
              loading={isImporting}
              leadingIcon={Upload}
            >
              Import students
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={!canImport || isImporting || isUpdating}
                  leadingIcon={Upload}
                >
                  Bulk update records
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Update students from this CSV?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Each row must include a student ID and at least one of grade level, major pathway, or minor pathway. Only columns in the file are changed; blank values clear that field.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isUpdating}
                    onClick={onBulkUpdate}
                  >
                    Update students
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              type="button"
              variant="secondary"
              onClick={onExport}
              loading={isExporting}
              leadingIcon={Download}
            >
              Export CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            New students receive a random temporary password that must be exported after import.
          </p>
        </div>
      </AdminPanel>

      <div className="space-y-4">
        <AdminPanel title="Import Notes" contentClassName="space-y-3 text-sm text-muted-foreground">
          <p>Grade level must be a number from 9 to 12.</p>
          <p>Minor pathway must be different from the major pathway.</p>
          <p>Existing student IDs are skipped to avoid overwriting live accounts.</p>
        </AdminPanel>

        <AdminPanel title="Bulk Update CSV" contentClassName="space-y-3">
          <pre className="overflow-x-auto rounded-lg bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
            <code>{studentBulkUpdateCsvExample}</code>
          </pre>
          <p className="text-sm text-muted-foreground">
            Include <span className="text-foreground">student_id</span> and only the columns to change: grade_level, major_pathway, or minor_pathway. A blank value clears an included field.
          </p>
        </AdminPanel>

        {lastStudentImport ? (
          <AdminPanel title="Latest Import" contentClassName="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <AdminMetric label="Created" value={lastStudentImport.created} />
              <AdminMetric label="Skipped" value={lastStudentImport.skipped} />
              <AdminMetric label="Temp Passwords" value={lastStudentImport.generatedCredentials.length} />
            </div>

            {lastStudentImport.generatedCredentials.length > 0 ? (
              <Button type="button" onClick={onExportGeneratedPasswords} leadingIcon={Download}>
                Export temp passwords CSV
              </Button>
            ) : null}

            {lastStudentImport.errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Skipped rows</p>
                <ScrollArea
                  className="rounded-lg border bg-muted/30 text-xs text-muted-foreground"
                  viewportClassName="max-h-48 p-3"
                >
                  {lastStudentImport.errors.map((error, index) => (
                    <p key={`${error}-${index}`} className="leading-5">{error}</p>
                  ))}
                </ScrollArea>
              </div>
            ) : null}
          </AdminPanel>
        ) : null}

        {lastStudentUpdate ? (
          <AdminPanel title="Latest Bulk Update" contentClassName="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <AdminMetric label="Updated" value={lastStudentUpdate.updated} />
              <AdminMetric label="Skipped" value={lastStudentUpdate.skipped} />
            </div>
            {lastStudentUpdate.errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Skipped rows</p>
                <ScrollArea
                  className="rounded-lg border bg-muted/30 text-xs text-muted-foreground"
                  viewportClassName="max-h-48 p-3"
                >
                  {lastStudentUpdate.errors.map((error, index) => (
                    <p key={`${error}-${index}`} className="leading-5">{error}</p>
                  ))}
                </ScrollArea>
              </div>
            ) : null}
          </AdminPanel>
        ) : null}
      </div>
    </div>
  );
}
