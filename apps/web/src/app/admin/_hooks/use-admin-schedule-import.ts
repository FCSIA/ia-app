'use client';

import { useMemo, useState } from 'react';
import { useAction, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type {
  StudentBulkUpdateResult,
  StudentImportResult,
} from '../_lib/types';
import {
  previewStudentBulkUpdateCsv,
  previewStudentImportCsv,
} from '../_lib/student-roster-csv';
import { canSubmitRoster, validRosterRows } from '../_lib/roster-csv';
import { useRosterCsvFile } from './use-roster-csv-file';

export function useAdminScheduleImport(activeTab: AdminTabId) {
  const { toast } = useToast();

  const file = useRosterCsvFile();
  const [mode, setMode] = useState<'import' | 'update'>('import');
  const importPreview = useMemo(
    () => (file.text === null ? null : previewStudentImportCsv(file.text)),
    [file.text],
  );
  const updatePreview = useMemo(
    () => (file.text === null ? null : previewStudentBulkUpdateCsv(file.text)),
    [file.text],
  );
  const [lastStudentImport, setLastStudentImport] =
    useState<StudentImportResult | null>(null);
  const [lastStudentUpdate, setLastStudentUpdate] =
    useState<StudentBulkUpdateResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const importStudents = useAction(api.users.admin.importStudents);
  const updateStudents = useAction(api.users.admin.updateStudents);
  const exportRows = useQuery(
    api.users.admin.exportStudents,
    activeTab === 'schedule' ? {} : 'skip',
  );

  const importStudentsMutation = {
    isPending: isImporting,
    mutate: async () => {
      if (
        !importPreview ||
        !canSubmitRoster(importPreview) ||
        isImporting ||
        isUpdating ||
        mode !== 'import'
      )
        return;
      file.setError(undefined);
      setIsImporting(true);
      try {
        const rows = validRosterRows(importPreview);
        const data = await importStudents({ rows });
        setLastStudentImport(data);
        file.clear();
        toast({
          title: `Imported ${data.created} students`,
          description: `${data.skipped} skipped${data.generatedCredentials.length ? ' · temp passwords ready to export' : ''}`,
        });
      } catch (err) {
        file.setError(
          err instanceof Error
            ? err.message
            : 'Import failed. Your preview is still here.',
        );
        toast({
          title: err instanceof Error ? err.message : 'Import failed',
          variant: 'destructive',
        });
      } finally {
        setIsImporting(false);
      }
    },
  };

  const bulkUpdateStudents = async () => {
    if (
      !updatePreview ||
      !canSubmitRoster(updatePreview) ||
      isImporting ||
      isUpdating ||
      mode !== 'update'
    )
      return;
    file.setError(undefined);
    setIsUpdating(true);
    try {
      const data = await updateStudents({
        rows: validRosterRows(updatePreview),
      });
      setLastStudentUpdate(data);
      file.clear();
      toast({
        title: `Updated ${data.updated} students`,
        description: `${data.skipped} skipped`,
      });
    } catch (err) {
      file.setError(
        err instanceof Error
          ? err.message
          : 'Update failed. Your preview is still here.',
      );
      toast({
        title: err instanceof Error ? err.message : 'Bulk update failed',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const exportStudentsMutation = {
    isPending: isExporting,
    mutate: () => {
      if (exportRows === undefined || isExporting) return;
      setIsExporting(true);
      downloadCsv(
        'students.csv',
        exportRows.map((student) => [
          student.firstName,
          student.lastName,
          student.uniqueId,
          student.email,
          student.gradeLevel ?? '',
          student.major ?? '',
          student.minor ?? '',
        ]),
        [
          'first_name',
          'last_name',
          'student_id',
          'email',
          'grade_level',
          'major_pathway',
          'minor_pathway',
        ],
      );
      toast({ title: 'Student CSV exported' });
      setIsExporting(false);
    },
  };

  const exportGeneratedPasswords = () => {
    if (!lastStudentImport?.generatedCredentials.length) return;

    downloadCsv(
      'student-temp-passwords.csv',
      lastStudentImport.generatedCredentials.map((student) => [
        student.firstName,
        student.lastName,
        student.uniqueId,
        student.email,
        student.temporaryPassword,
      ]),
      ['first_name', 'last_name', 'student_id', 'email', 'temporary_password'],
    );

    toast({ title: 'Temporary passwords exported' });
  };

  return {
    enabled: activeTab === 'schedule',
    studentCsvInputKey: file.inputKey,
    setStudentCsvFile: file.selectFile,
    fileName: file.fileName,
    isReading: file.isReading,
    fileError: file.error,
    clearFile: file.clear,
    mode,
    setMode,
    preview: mode === 'import' ? importPreview : updatePreview,
    canImport:
      !file.isReading &&
      canSubmitRoster(mode === 'import' ? importPreview : updatePreview),
    isImporting: importStudentsMutation.isPending,
    onImport: () => importStudentsMutation.mutate(),
    isExporting: exportStudentsMutation.isPending,
    canExport: exportRows !== undefined,
    onExport: () => exportStudentsMutation.mutate(),
    lastStudentImport,
    isUpdating,
    onBulkUpdate: () => void bulkUpdateStudents(),
    lastStudentUpdate,
    onExportGeneratedPasswords: exportGeneratedPasswords,
  };
}
