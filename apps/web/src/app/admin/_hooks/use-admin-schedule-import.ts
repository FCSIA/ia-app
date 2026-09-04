'use client';

import { useState } from 'react';
import { useAction, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';
import type { StudentImportResult } from '../_lib/types';
import type { FunctionArgs } from 'convex/server';

type StudentImportRow = FunctionArgs<typeof api.users.admin.importStudents>['rows'][number];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value;
  }
  return undefined;
}

function parsePathway(value?: string) {
  if (!value) return undefined;
  const normalized = normalizeHeader(value);
  const map: Record<string, StudentImportRow['major']> = {
    it: 'INFORMATION_TECHNOLOGY',
    informationtechnology: 'INFORMATION_TECHNOLOGY',
    healthscience: 'HEALTH_SCIENCE',
    engineering: 'ENGINEERING',
    stem: 'ENGINEERING',
    business: 'INFORMATION_TECHNOLOGY',
    arts: 'HEALTH_SCIENCE',
  };
  return map[normalized];
}

function parseStudentCsv(text: string): StudentImportRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    const gradeValue = pick(row, 'grade level', 'grade_level', 'gradeLevel', 'grade');
    const gradeLevel = gradeValue ? Number.parseInt(gradeValue, 10) : undefined;
    return {
      uniqueId: pick(row, 'student id', 'student_id', 'studentId', 'unique id', 'unique_id', 'id') ?? '',
      firstName: pick(row, 'first name', 'first_name', 'firstName', 'first') ?? '',
      lastName: pick(row, 'last name', 'last_name', 'lastName', 'last') ?? '',
      email: pick(row, 'email', 'student email'),
      gradeLevel: Number.isInteger(gradeLevel) ? gradeLevel : undefined,
      major: parsePathway(pick(row, 'major pathway', 'major_pathway', 'majorPathway', 'pathway', 'major')),
      minor: parsePathway(pick(row, 'minor pathway', 'minor_pathway', 'minorPathway', 'minor')),
    };
  });
}

export function useAdminScheduleImport(activeTab: AdminTabId) {
  const { toast } = useToast();

  const [studentCsvFile, setStudentCsvFile] = useState<File | null>(null);
  const [studentCsvInputKey, setStudentCsvInputKey] = useState(0);
  const [lastStudentImport, setLastStudentImport] = useState<StudentImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const importStudents = useAction(api.users.admin.importStudents);
  const exportRows = useQuery(api.users.admin.exportStudents, activeTab === 'schedule' ? {} : 'skip') ?? [];

  const importStudentsMutation = {
    isPending: isImporting,
    mutate: async () => {
      if (!studentCsvFile) throw new Error('Select a CSV file first');
      setIsImporting(true);
      try {
        const rows = parseStudentCsv(await studentCsvFile.text());
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
    onExportGeneratedPasswords: exportGeneratedPasswords,
  };
}
