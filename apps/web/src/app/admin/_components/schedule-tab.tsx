'use client';

import { Download, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { StudentImportResult } from '../_lib/types';

export function AdminScheduleTab({
  studentCsvInputKey,
  onStudentCsvFileChange,
  generatePasswords,
  onGeneratePasswordsChange,
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
  generatePasswords: boolean;
  onGeneratePasswordsChange: (value: boolean) => void;
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
  isExporting: boolean;
  onExport: () => void;
  lastStudentImport: StudentImportResult | null;
  onExportGeneratedPasswords: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Student Roster Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Import students from a roster CSV. Email is derived automatically as <span className="font-mono text-foreground">student_id@fcstu.org</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              {['First Name', 'Last Name', 'Student ID', 'Grade Level', 'Major Pathway', 'Minor Pathway (optional)'].map((field) => (
                <Badge key={field} variant="dot" size="sm">
                  {field}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Accepted pathway labels: <span className="text-foreground">IT</span>, <span className="text-foreground">Health Science</span>, <span className="text-foreground">Engineering</span>.
            </p>
          </div>

          <div className="space-y-3">
            <Input
              key={studentCsvInputKey}
              type="file"
              accept=".csv"
              onChange={(event) => onStudentCsvFileChange(event.target.files?.[0] || null)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={generatePasswords ? 'primary' : 'tertiary'}
                onClick={() => onGeneratePasswordsChange(!generatePasswords)}
              >
                {generatePasswords ? 'Temp Passwords On' : 'Temp Passwords Off'}
              </Button>
              <Button type="button" onClick={onImport} disabled={!canImport || isImporting} leadingIcon={Upload}>
                {isImporting ? 'Importing...' : 'Import Students'}
              </Button>
              <Button type="button" variant="secondary" onClick={onExport} disabled={isExporting} leadingIcon={Download}>
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {generatePasswords
                ? 'New students will receive a random temporary password that you can export after import.'
                : 'If disabled, new students default to their student ID as the initial password.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Import Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
            <p>Grade level must be a number from 9 to 12.</p>
            <p>Minor pathway must be different from the major pathway.</p>
            <p>Existing student IDs are skipped to avoid overwriting live accounts.</p>
          </CardContent>
        </Card>

        {lastStudentImport ? (
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">Latest Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-3 gap-3">
                <ImportMetric label="Created" value={lastStudentImport.created} />
                <ImportMetric label="Skipped" value={lastStudentImport.skipped} />
                <ImportMetric label="Temp Passwords" value={lastStudentImport.generatedCredentials.length} />
              </div>

              {lastStudentImport.generatedCredentials.length > 0 ? (
                <Button type="button" onClick={onExportGeneratedPasswords} leadingIcon={Download}>
                  Export Temp Passwords CSV
                </Button>
              ) : null}

              {lastStudentImport.errors.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Skipped rows</p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {lastStudentImport.errors.map((error, index) => (
                      <p key={`${error}-${index}`} className="leading-5">{error}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

