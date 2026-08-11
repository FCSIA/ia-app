'use client';

import { Download, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StudentImportResult } from '../_lib/types';
import { AdminMetric, AdminPanel } from './admin-ui';

const studentCsvExample = `first_name,last_name,student_id,email,grade_level,major_pathway,minor_pathway
Alex,Smith,STU001,alex.smith@example.com,10,IT,`;

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
      </div>
    </div>
  );
}
