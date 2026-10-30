'use client';

import { useMemo, useState } from 'react';
import { useAction } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '../_lib/admin-utils';
import { previewAdministratorRosterCsv } from '../_lib/administrator-roster-csv';
import { canSubmitRoster, validRosterRows } from '../_lib/roster-csv';
import { useRosterCsvFile } from './use-roster-csv-file';
import type { AdministratorImportResult } from '../_lib/types';
import type { AdminTabId } from './use-admin-tab';

export function useAdministratorRosterImport(activeTab: AdminTabId) {
  const { toast } = useToast();
  const file = useRosterCsvFile();
  const preview = useMemo(
    () =>
      file.text === null ? null : previewAdministratorRosterCsv(file.text),
    [file.text],
  );
  const [lastImport, setLastImport] =
    useState<AdministratorImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importAdministrators = useAction(api.users.admin.importAdministrators);

  const onImport = async () => {
    if (!preview || !canSubmitRoster(preview) || isImporting) return;
    file.setError(undefined);

    setIsImporting(true);
    try {
      const data = await importAdministrators({
        rows: validRosterRows(preview),
      });
      setLastImport(data);
      file.clear();
      toast({
        title: `Imported ${data.created} administrators`,
        description: `${data.skipped} skipped${data.generatedCredentials.length ? ' · temporary passwords ready to export' : ''}`,
      });
    } catch (error) {
      file.setError(
        error instanceof Error
          ? error.message
          : 'Import failed. Your preview is still here.',
      );
      toast({
        title: error instanceof Error ? error.message : 'Import failed',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const onExportGeneratedPasswords = () => {
    if (!lastImport?.generatedCredentials.length) return;
    downloadCsv(
      'administrator-temp-passwords.csv',
      lastImport.generatedCredentials.map((administrator) => [
        administrator.firstName,
        administrator.lastName,
        administrator.uniqueId,
        administrator.email,
        administrator.temporaryPassword,
      ]),
      [
        'first_name',
        'last_name',
        'administrator_id',
        'email',
        'temporary_password',
      ],
    );
    toast({ title: 'Temporary passwords exported' });
  };

  return {
    enabled: activeTab === 'administrator-roster',
    fileInputKey: file.inputKey,
    setFile: file.selectFile,
    fileName: file.fileName,
    isReading: file.isReading,
    fileError: file.error,
    clearFile: file.clear,
    preview,
    canImport: !file.isReading && canSubmitRoster(preview),
    isImporting,
    onImport: () => void onImport(),
    lastImport,
    onExportGeneratedPasswords,
  };
}
