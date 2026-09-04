'use client';

import { useState } from 'react';
import { useAction } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '../_lib/admin-utils';
import { parseAdministratorRosterCsv } from '../_lib/administrator-roster-csv';
import type { AdministratorImportResult } from '../_lib/types';
import type { AdminTabId } from './use-admin-tab';

export function useAdministratorRosterImport(activeTab: AdminTabId) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [lastImport, setLastImport] = useState<AdministratorImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importAdministrators = useAction(api.users.admin.importAdministrators);

  const onImport = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await importAdministrators({
        rows: parseAdministratorRosterCsv(await file.text()),
      });
      setLastImport(data);
      setFile(null);
      setFileInputKey((current) => current + 1);
      toast({
        title: `Imported ${data.created} administrators`,
        description: `${data.skipped} skipped${data.generatedCredentials.length ? ' · temporary passwords ready to export' : ''}`,
      });
    } catch (error) {
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
      ['first_name', 'last_name', 'administrator_id', 'email', 'temporary_password'],
    );
    toast({ title: 'Temporary passwords exported' });
  };

  return {
    enabled: activeTab === 'administrator-roster',
    fileInputKey,
    setFile,
    canImport: !!file,
    isImporting,
    onImport: () => void onImport(),
    lastImport,
    onExportGeneratedPasswords,
  };
}
