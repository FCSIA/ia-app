'use client';

import { AdministratorRosterTab } from '../administrator-roster-tab';
import { useAdministratorRosterImport } from '../../_hooks/use-admin-administrator-roster-import';

export function AdministratorRosterTabPanel() {
  const roster = useAdministratorRosterImport('administrator-roster');

  return (
    <AdministratorRosterTab
      fileInputKey={roster.fileInputKey}
      onFileChange={roster.setFile}
      canImport={roster.canImport}
      isImporting={roster.isImporting}
      onImport={roster.onImport}
      lastImport={roster.lastImport}
      onExportGeneratedPasswords={roster.onExportGeneratedPasswords}
    />
  );
}
