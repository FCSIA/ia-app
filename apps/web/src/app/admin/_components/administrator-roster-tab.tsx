'use client';

import { Download, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AdministratorImportResult } from '../_lib/types';
import { AdminMetric, AdminPanel } from './admin-ui';

const administratorCsvExample = `first_name,last_name,administrator_id,email
Ada,Lovelace,ADM001,ada.lovelace@example.org`;

export function AdministratorRosterTab({
  fileInputKey,
  onFileChange,
  canImport,
  isImporting,
  onImport,
  lastImport,
  onExportGeneratedPasswords,
}: {
  fileInputKey: number;
  onFileChange: (file: File | null) => void;
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
  lastImport: AdministratorImportResult | null;
  onExportGeneratedPasswords: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <AdminPanel title="Administrator Roster Import" contentClassName="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {['First Name', 'Last Name', 'Administrator ID', 'Email'].map((field) => (
              <Badge key={field} variant="solid" size="sm">
                {field}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Every row creates an <span className="text-foreground">Admin</span> account. Student and Super Admin roles are never imported here.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-foreground">Example CSV</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
            <code>{administratorCsvExample}</code>
          </pre>
          <p className="text-xs text-muted-foreground">
            Use the first line as your header row. An administrator ID and email are required for every account.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            key={fileInputKey}
            type="file"
            accept=".csv"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
          <Button
            type="button"
            onClick={onImport}
            disabled={!canImport}
            loading={isImporting}
            leadingIcon={Upload}
          >
            Import administrators
          </Button>
          <p className="text-xs text-muted-foreground">
            New administrators receive a random temporary password. Export it immediately and share it through an approved secure channel.
          </p>
        </div>
      </AdminPanel>

      <div className="space-y-4">
        <AdminPanel title="Import Safeguards" contentClassName="space-y-3 text-sm text-muted-foreground">
          <p>Only Super Admins can import this roster.</p>
          <p>Existing administrator IDs are skipped, never overwritten.</p>
          <p>One CSV can contain up to 200 administrators.</p>
        </AdminPanel>

        {lastImport ? (
          <AdminPanel title="Latest Import" contentClassName="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <AdminMetric label="Created" value={lastImport.created} />
              <AdminMetric label="Skipped" value={lastImport.skipped} />
              <AdminMetric label="Temp Passwords" value={lastImport.generatedCredentials.length} />
            </div>

            {lastImport.generatedCredentials.length > 0 ? (
              <Button type="button" onClick={onExportGeneratedPasswords} leadingIcon={Download}>
                Export temp passwords CSV
              </Button>
            ) : null}

            {lastImport.errors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Skipped rows</p>
                <ScrollArea
                  className="rounded-lg border bg-muted/30 text-xs text-muted-foreground"
                  viewportClassName="max-h-48 p-3"
                >
                  {lastImport.errors.map((error, index) => (
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
