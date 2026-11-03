'use client';

import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-input';
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
import type { AdministratorImportResult } from '../_lib/types';
import { AdminPanel } from './admin-ui';
import {
  RosterCsvHelp,
  RosterCsvReview,
  RosterImportResult,
} from './roster-csv-review';

export function AdministratorRosterTab({
  fileInputKey,
  onFileChange,
  canImport,
  isImporting,
  onImport,
  lastImport,
  onExportGeneratedPasswords,
  fileName,
  isReading,
  fileError,
  clearFile,
  preview,
}: {
  fileInputKey: number;
  onFileChange: (file: File | null) => void;
  canImport: boolean;
  isImporting: boolean;
  onImport: () => void;
  lastImport: AdministratorImportResult | null;
  onExportGeneratedPasswords: () => void;
  fileName?: string;
  isReading: boolean;
  fileError?: string;
  clearFile: () => void;
  preview: RosterCsvPreview<unknown> | null;
}) {
  const count = preview?.rows.length ?? 0;
  const accountLabel = count === 1 ? 'administrator' : 'administrators';
  return (
    <div className="space-y-4">
      <AdminPanel title="Administrator roster" contentClassName="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose a CSV to validate and review before creating administrator
          accounts.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <FileInput
            key={fileInputKey}
            accept=".csv,text/csv"
            label={fileName ? 'Replace CSV' : 'Choose CSV'}
            onFileSelect={onFileChange}
            disabled={isImporting}
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
                disabled={isImporting}
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
                  disabled={!canImport || isImporting}
                  loading={isImporting}
                >
                  Review import
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Import {count} {accountLabel}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Create Admin accounts from {fileName}. Existing IDs will be
                    skipped. This grants administrator access. Export new
                    temporary passwords immediately after import.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!canImport || isImporting}
                    onClick={onImport}
                  >
                    Import {count} {accountLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground">
              {canImport
                ? 'File validation passed. Existing accounts are checked when submitted.'
                : 'Correct the validation errors below, then replace this CSV.'}
            </p>
          </div>
        ) : null}
        <RosterCsvHelp>
          <p>
            Only Super Admins can import this roster. Every row creates an Admin
            account. Student and Super Admin roles are never imported here.
          </p>
          <p>
            First name, last name, administrator ID, and email are required. Up
            to 200 rows per CSV. Existing IDs are skipped.
          </p>
          <pre className="overflow-x-auto font-mono text-xs">
            <code>
              {
                'first_name,last_name,administrator_id,email\nAda,Lovelace,ADM001,ada.lovelace@example.org'
              }
            </code>
          </pre>
          <p>
            New administrators receive a temporary password. Export it after
            import and share it through an approved secure channel.
          </p>
        </RosterCsvHelp>
      </AdminPanel>
      {preview ? <RosterCsvReview preview={preview} /> : null}
      {lastImport ? (
        <RosterImportResult
          result={lastImport}
          onExportPasswords={onExportGeneratedPasswords}
        />
      ) : null}
    </div>
  );
}
