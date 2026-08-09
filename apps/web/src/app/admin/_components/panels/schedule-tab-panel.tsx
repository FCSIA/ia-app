'use client';

import { AdminScheduleTab } from '../schedule-tab';
import { useAdminScheduleImport } from '../../_hooks/use-admin-schedule-import';

export function ScheduleTabPanel() {
  const schedule = useAdminScheduleImport('schedule');

  return (
    <AdminScheduleTab
      studentCsvInputKey={schedule.studentCsvInputKey}
      onStudentCsvFileChange={schedule.setStudentCsvFile}
      canImport={schedule.canImport}
      isImporting={schedule.isImporting}
      onImport={schedule.onImport}
      isExporting={schedule.isExporting}
      onExport={schedule.onExport}
      lastStudentImport={schedule.lastStudentImport}
      onExportGeneratedPasswords={schedule.onExportGeneratedPasswords}
    />
  );
}
