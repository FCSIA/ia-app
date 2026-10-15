"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ImageUp, ScanLine, Trash2 } from "lucide-react";
import type { CourseSummary } from "@/components/courses/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { useAction, useMutation } from "@/lib/convex-react";
import {
  parseInfiniteCampusSchedule,
  type ImportedScheduleRow,
  type OcrScheduleRow,
} from "@/lib/schedule-ocr";
import { api } from "~/apps/convex/src/_generated/api";

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
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const scanImage = useAction(api.schedule.importOcr.scanImage);

  const courseMap = useMemo(
    () =>
      new Map<string, CourseSummary>(
        courses.map((course) => [course.id, course]),
      ),
    [courses],
  );
  const assignedPeriods = rows
    .map((row) => row.periodNumber)
    .filter((period): period is number => period !== null);
  const hasDuplicatePeriod =
    new Set(assignedPeriods).size !== assignedPeriods.length;
  const canApply =
    rows.length > 0 &&
    assignedPeriods.length === rows.length &&
    !hasDuplicatePeriod;

  const reset = () => {
    setFile(null);
    setRows([]);
    setProgress(0);
    setStatus("");
    setError(null);
    setScanning(false);
  };

  const scan = async () => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    setScanning(true);
    setRows([]);
    setError(null);
    setProgress(0);
    try {
      setStatus("Uploading image");
      setProgress(20);
      const uploaded = await uploadFileToConvex(
        {
          generateUploadUrl: () =>
            generateUploadUrl({ purpose: "SCHEDULE_OCR" }),
        },
        file,
      );
      setStatus("Reading schedule");
      setProgress(60);
      const result = await scanImage(uploaded);
      const parsed = parseInfiniteCampusSchedule(result.fullText, courses);
      if (!parsed.length)
        setError(
          "No schedule rows were found. Try a clearer, more complete picture.",
        );
      else {
        setRows(parsed);
        setProgress(100);
      }
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Could not read this image.",
      );
    } finally {
      setScanning(false);
    }
  };

  const applyRows = () => {
    if (!canApply) return;
    onApply(
      rows.map((row) => ({
        periodNumber: row.periodNumber!,
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
            A clear picture is sent to Google Cloud Vision to read, then deleted
            immediately from IA storage. Review every class before applying.
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
                <span className="capitalize">
                  {status || "Preparing import"}
                </span>
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
              <h3 className="text-sm font-semibold text-foreground">
                Review classes
              </h3>
              {!canApply ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>
                    {hasDuplicatePeriod
                      ? "Each class needs a different period."
                      : "Choose a period for every class before applying."}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/70">
                <Table className="min-w-[28rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Period</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="w-20">Match</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Remove</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.id} index={index}>
                        <TableCell>
                          <Select
                            value={
                              row.periodNumber === null
                                ? "unassigned"
                                : String(row.periodNumber)
                            }
                            onValueChange={(value) => {
                              if (value === "unassigned") return;
                              const periodNumber = Number.parseInt(value, 10);
                              if (Number.isInteger(periodNumber))
                                setRows((current) =>
                                  current.map((entry) =>
                                    entry.id === row.id
                                      ? { ...entry, periodNumber }
                                      : entry,
                                  ),
                                );
                            }}
                          >
                            <SelectTrigger />
                            <SelectContent>
                              <SelectItem value="unassigned" index={0} disabled>
                                Choose
                              </SelectItem>
                              {Array.from(
                                { length: 8 },
                                (_, number) => number + 1,
                              ).map((number) => (
                                <SelectItem
                                  key={number}
                                  value={String(number)}
                                  index={number}
                                >
                                  {number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[12rem]">
                          <Select
                            value={row.matchedCourse?.id ?? "custom"}
                            onValueChange={(courseId) => {
                              const course = courseMap.get(courseId) ?? null;
                              setRows((current) =>
                                current.map((entry) =>
                                  entry.id === row.id
                                    ? {
                                        ...entry,
                                        matchedCourse: course,
                                        className:
                                          course?.title ?? entry.className,
                                        confidence: course
                                          ? 1
                                          : entry.confidence,
                                      }
                                    : entry,
                                ),
                              );
                            }}
                          >
                            <SelectTrigger />
                            <SelectContent>
                              <SelectItem value="custom" index={0}>
                                {row.className} (use reading)
                              </SelectItem>
                              {courses.map((course, courseIndex) => (
                                <SelectItem
                                  key={course.id}
                                  value={course.id}
                                  index={courseIndex + 1}
                                >
                                  {course.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p
                            className="mt-1 truncate text-[11px] text-muted-foreground"
                            title={row.sourceText}
                          >
                            Read as: {row.sourceText}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            size="sm"
                            color={
                              row.confidence >= 0.8
                                ? "emerald"
                                : row.confidence >= 0.56
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {Math.round(row.confidence * 100)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove ${row.periodNumber === null ? "unassigned class" : `period ${row.periodNumber}`}`}
                            onClick={() =>
                              setRows((current) =>
                                current.filter((entry) => entry.id !== row.id),
                              )
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={scanning}
          >
            Cancel
          </Button>
          {rows.length > 0 ? (
            <Button type="button" onClick={applyRows} disabled={!canApply}>
              Use {rows.length} {rows.length === 1 ? "class" : "classes"}
            </Button>
          ) : (
            <Button
              type="button"
              leadingIcon={ScanLine}
              onClick={() => void scan()}
              disabled={!file || scanning}
            >
              Scan picture
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
