'use client';

import { AdministratorRosterTab } from '../administrator-roster-tab';
import { useAdministratorRosterImport } from '../../_hooks/use-admin-administrator-roster-import';

export function AdministratorRosterTabPanel() {
  const roster = useAdministratorRosterImport('administrator-roster');

  return (
    <AdministratorRosterTab
      fileName={roster.fileName}
      isReading={roster.isReading}
      fileError={roster.fileError}
      clearFile={roster.clearFile}
      preview={roster.preview}
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
