'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { StudentImportResult } from '../_lib/types';

export function useAdminScheduleImport(activeTab: AdminTabId) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [studentCsvFile, setStudentCsvFile] = useState<File | null>(null);
  const [studentCsvInputKey, setStudentCsvInputKey] = useState(0);
  const [generatePasswords, setGeneratePasswords] = useState(true);
  const [lastStudentImport, setLastStudentImport] = useState<StudentImportResult | null>(null);

  const importStudentsMutation = useMutation({
    mutationFn: async () => {
      if (!studentCsvFile) throw new Error('Select a CSV file first');
      const response = await usersApi.importCsv(studentCsvFile, { generatePasswords });
      return response.data as StudentImportResult;
    },
    onSuccess: (data) => {
      setLastStudentImport(data);
      setStudentCsvFile(null);
      setStudentCsvInputKey((current) => current + 1);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: `Imported ${data.created} students`,
        description: `${data.skipped} skipped${data.generatedCredentials.length ? ' · temp passwords ready to export' : ''}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: err.response?.data?.message || err.message || 'Import failed',
        variant: 'destructive',
      });
    },
  });

  const exportStudentsMutation = useMutation({
    mutationFn: () => usersApi.exportStudentsCsv(),
    onSuccess: (response) => {
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'students.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Student CSV exported' });
    },
    onError: (err: any) => {
      toast({
        title: err.response?.data?.message || 'Could not export students',
        variant: 'destructive',
      });
    },
  });

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
    generatePasswords,
    setGeneratePasswords,
    canImport: !!studentCsvFile,
    isImporting: importStudentsMutation.isPending,
    onImport: () => importStudentsMutation.mutate(),
    isExporting: exportStudentsMutation.isPending,
    onExport: () => exportStudentsMutation.mutate(),
    lastStudentImport,
    onExportGeneratedPasswords: exportGeneratedPasswords,
  };
}
