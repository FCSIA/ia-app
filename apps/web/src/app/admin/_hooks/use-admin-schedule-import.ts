'use client';

import { useState } from 'react';
import { useAction, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { StudentBulkUpdateResult, StudentImportResult } from '../_lib/types';
import { parseStudentBulkUpdateCsv, parseStudentImportCsv } from '../_lib/student-roster-csv';

export function useAdminScheduleImport(activeTab: AdminTabId) {
  const { toast } = useToast();

  const [studentCsvFile, setStudentCsvFile] = useState<File | null>(null);
  const [studentCsvInputKey, setStudentCsvInputKey] = useState(0);
  const [lastStudentImport, setLastStudentImport] = useState<StudentImportResult | null>(null);
  const [lastStudentUpdate, setLastStudentUpdate] = useState<StudentBulkUpdateResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const importStudents = useAction(api.users.admin.importStudents);
  const updateStudents = useAction(api.users.admin.updateStudents);
  const exportRows = useQuery(api.users.admin.exportStudents, activeTab === 'schedule' ? {} : 'skip') ?? [];

  const importStudentsMutation = {
    isPending: isImporting,
    mutate: async () => {
      if (!studentCsvFile) throw new Error('Select a CSV file first');
      setIsImporting(true);
      try {
        const rows = parseStudentImportCsv(await studentCsvFile.text());
        const data = await importStudents({ rows });
        setLastStudentImport(data);
        setStudentCsvFile(null);
        setStudentCsvInputKey((current) => current + 1);
        toast({
          title: `Imported ${data.created} students`,
          description: `${data.skipped} skipped${data.generatedCredentials.length ? ' · temp passwords ready to export' : ''}`,
        });
      } catch (err) {
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
    if (!studentCsvFile) return;
    setIsUpdating(true);
    try {
      const data = await updateStudents({ rows: parseStudentBulkUpdateCsv(await studentCsvFile.text()) });
      setLastStudentUpdate(data);
      setStudentCsvFile(null);
      setStudentCsvInputKey((current) => current + 1);
      toast({ title: `Updated ${data.updated} students`, description: `${data.skipped} skipped` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Bulk update failed', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const exportStudentsMutation = {
    isPending: isExporting,
    mutate: () => {
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
        ['first_name', 'last_name', 'student_id', 'email', 'grade_level', 'major_pathway', 'minor_pathway'],
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
    studentCsvInputKey,
    setStudentCsvFile,
    canImport: !!studentCsvFile,
    isImporting: importStudentsMutation.isPending,
    onImport: () => importStudentsMutation.mutate(),
    isExporting: exportStudentsMutation.isPending,
    onExport: () => exportStudentsMutation.mutate(),
    lastStudentImport,
    isUpdating,
    onBulkUpdate: () => void bulkUpdateStudents(),
    lastStudentUpdate,
    onExportGeneratedPasswords: exportGeneratedPasswords,
  };
}
