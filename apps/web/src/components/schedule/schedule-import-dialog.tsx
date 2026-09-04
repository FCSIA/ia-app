'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ImageUp, ScanLine, Trash2 } from 'lucide-react';
import type { CourseSummary } from '@/components/courses/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseInfiniteCampusSchedule, type ImportedScheduleRow, type OcrScheduleRow } from '@/lib/schedule-ocr';

export function ScheduleImportDialog({
  courses,
  onApply,
}: {
  courses: CourseSummary[];
  onApply: (rows: ImportedScheduleRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<OcrScheduleRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const courseMap = useMemo(
    () => new Map<string, CourseSummary>(courses.map((course) => [course.id, course])),
    [courses],
  );

  const reset = () => {
    setFile(null);
    setRows([]);
    setProgress(0);
    setStatus('');
    setError(null);
    setScanning(false);
  };

  const scan = async () => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setError('Choose an image smaller than 12 MB.');
      return;
    }

    setScanning(true);
    setRows([]);
    setError(null);
    setProgress(0);
    try {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/tesseract-core.wasm.js',
        langPath: '/tesseract',
        workerBlobURL: false,
        logger: (message) => {
          setStatus(message.status.replace(/_/g, ' '));
          if (typeof message.progress === 'number') {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO,
          preserve_interword_spaces: '1',
        });
        const result = await worker.recognize(file);
        const parsed = parseInfiniteCampusSchedule(result.data.text, courses);
        if (!parsed.length) {
          setError('No period and course pairs were found. Try a sharper screenshot of Infinite Campus Term view.');
        } else {
          setRows(parsed);
        }
      } finally {
        await worker.terminate();
      }
    } catch (scanError) {
      console.error('OCR scan failed:', scanError);
      setError(
        'Error details: ' + 
        (scanError instanceof Error ? scanError.message : '') + 
        ' | Raw: ' + String(scanError) + 
        ' | JSON: ' + JSON.stringify(scanError)
      );
    } finally {
      setScanning(false);
    }
  };

  const applyRows = () => {
    onApply(
      rows.map((row) => ({
        periodNumber: row.periodNumber,
        course: row.matchedCourse,
        className: row.className,
      })),
    );
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !scanning) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" leadingIcon={ImageUp}>
          Import from Picture
        </Button>
      </DialogTrigger>
      <DialogContent size="lg" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import schedule</DialogTitle>
          <DialogDescription>
            Upload a clear picture displaying a list of your classes. It stays on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="ic-schedule-image">Picture</FieldLabel>
            <Input
              id="ic-schedule-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={scanning}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setRows([]);
                setError(null);
              }}
            />
            <FieldDescription>
              Include period labels and course names.
            </FieldDescription>
          </Field>

          {scanning ? (
            <div className="flex flex-col gap-2" aria-live="polite">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                <span className="capitalize">{status || 'Preparing OCR'}</span>
                <span className="ml-auto tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Import needs another look</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {rows.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">Review classes</h3>
              <div className="overflow-hidden rounded-lg border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Period</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="w-20">Match</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Remove</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.periodNumber} index={index}>
                        <TableCell className="font-medium text-foreground">{row.periodNumber}</TableCell>
                        <TableCell>
                          <Select
                            value={row.matchedCourse?.id ?? 'custom'}
                            onValueChange={(courseId) => {
                              const course = courseMap.get(courseId) ?? null;
                              setRows((current) =>
                                current.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        matchedCourse: course,
                                        className: course?.title ?? entry.className,
                                        confidence: course ? 1 : entry.confidence,
                                      }
                                    : entry,
                                ),
                              );
                            }}
                          >
                            <SelectTrigger />
                            <SelectContent>
                              <SelectItem value="custom" index={0}>
                                {row.className} (use OCR text)
                              </SelectItem>
                              {courses.map((course, courseIndex) => (
                                <SelectItem key={course.id} value={course.id} index={courseIndex + 1}>
                                  {course.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground" title={row.sourceText}>
                            Read as: {row.sourceText}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            size="sm"
                            color={row.confidence >= 0.8 ? 'emerald' : row.confidence >= 0.56 ? 'amber' : 'red'}
                          >
                            {Math.round(row.confidence * 100)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove period ${row.periodNumber}`}
                            onClick={() =>
                              setRows((current) => current.filter((_, entryIndex) => entryIndex !== index))
                            }
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={scanning}>
            Cancel
          </Button>
          {rows.length > 0 ? (
            <Button type="button" onClick={applyRows}>
              Use {rows.length} {rows.length === 1 ? 'class' : 'classes'}
            </Button>
          ) : (
            <Button type="button" leadingIcon={ScanLine} onClick={() => void scan()} disabled={!file || scanning}>
              Scan picture
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
