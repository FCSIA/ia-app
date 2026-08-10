"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { DayButton } from "react-day-picker";
import {
  CalendarPlus,
  CalendarDays,
  GripVertical,
  Info,
  LayoutTemplate,
  Link2,
  Plus,
  RotateCcw,
  Save,
  School,
  Trash2,
  Unlink2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { TabItem, TabPanel, Tabs, TabsList } from "@/components/ui/tabs";
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import { formatScheduleTime } from "@/components/schedule/schedule-utils";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { api } from "~/apps/convex/src/_generated/api";

type PlanBlock = FunctionArgs<
  typeof api.schedule.dayPlans.saveDateOverride
>["blocks"][number];
type TemplateKind = FunctionArgs<
  typeof api.schedule.dayPlans.saveTemplate
>["kind"];
type AdminWorkspace = NonNullable<
  FunctionReturnType<typeof api.schedule.dayPlans.getAdminWorkspace>
>;
type DayTemplate = AdminWorkspace["templates"][number];

const EMPTY_BLOCKS: PlanBlock[] = [];
const SCHOOL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function schoolDateKey() {
  const parts = SCHOOL_DATE_FORMATTER.formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function firstWeekdayInMonth(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  if (next.getDay() === 0) next.setDate(2);
  if (next.getDay() === 6) next.setDate(3);
  return next;
}

function toPlanBlocks(
  blocks: Array<{
    label: string;
    periodNumber: number | null;
    startTime: string;
    endTime: string;
  }>,
): PlanBlock[] {
  return blocks.map(({ label, periodNumber, startTime, endTime }) => ({
    label,
    periodNumber,
    startTime,
    endTime,
  }));
}

function addMinutes(time: string, minutes: number) {
  const [hours, currentMinutes] = time.split(":").map(Number);
  const total = Math.min(hours * 60 + currentMinutes + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function reorderBlockIdentity(blocks: PlanBlock[], from: number, to: number) {
  if (to < 0 || to >= blocks.length) return blocks;
  const timeSlots = blocks.map(({ startTime, endTime }) => ({
    startTime,
    endTime,
  }));
  const reordered = [...blocks];
  const [moved] = reordered.splice(from, 1);
  if (!moved) return blocks;
  reordered.splice(to, 0, moved);
  return reordered.map((block, index) => ({ ...block, ...timeSlots[index] }));
}

function planBlockValue(block: PlanBlock) {
  return `${block.periodNumber ?? "custom"}:${block.label}:${block.startTime}:${block.endTime}`;
}

function PlanPreview({ blocks }: { blocks: PlanBlock[] }) {
  return (
    <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Student preview
        </p>
        <span className="text-[11px] text-muted-foreground">
          Canonical mapping
        </span>
      </div>
      <div className="overflow-hidden rounded-xl bg-surface-3 shadow-surface-1">
        {blocks.length > 0 ? (
          <div className="divide-y divide-border/40">
            {blocks.map((block) => (
              <div
                key={`${block.startTime}-${block.endTime}-${block.periodNumber ?? "custom"}`}
                className="grid grid-cols-[4.5rem_1fr] gap-3 px-3 py-2.5"
              >
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatScheduleTime(block.startTime)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {block.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {block.periodNumber === null
                      ? "Shared custom block"
                      : block.periodNumber === 4 || block.periodNumber === 5
                        ? `Student's Period ${block.periodNumber} class, or Lunch when assigned`
                        : `Student's existing Period ${block.periodNumber} class`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Add a block to preview the day.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Reordering changes when a canonical period meets. It never copies or
        moves a student&apos;s saved course.
      </p>
    </aside>
  );
}

function PlanBlockEditor({
  blocks,
  onChange,
  readOnly = false,
}: {
  blocks: PlanBlock[];
  onChange: (blocks: PlanBlock[]) => void;
  readOnly?: boolean;
}) {
  const update = (index: number, patch: Partial<PlanBlock>) => {
    onChange(
      blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block,
      ),
    );
  };

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
        <div className="grid grid-cols-[2.25rem_minmax(8rem,1fr)_minmax(12rem,0.9fr)_2.25rem] gap-2 bg-surface-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-md:hidden">
          <span />
          <span>Block</span>
          <span>Time</span>
          <span />
        </div>
        <Sortable
          value={blocks}
          onValueChange={() => undefined}
          onMove={({ activeIndex, overIndex }) =>
            onChange(reorderBlockIdentity(blocks, activeIndex, overIndex))
          }
          getItemValue={planBlockValue}
          strategy="vertical"
          className="divide-y divide-border/40"
        >
          {blocks.map((block, index) => (
            <SortableItem
              key={planBlockValue(block)}
              value={planBlockValue(block)}
              disabled={readOnly}
              className="group bg-surface-2 data-[dragging=true]:relative data-[dragging=true]:z-20 data-[dragging=true]:rounded-lg data-[dragging=true]:shadow-surface-3"
            >
              <div className="grid gap-2 px-3 py-3 md:grid-cols-[2.25rem_minmax(8rem,1fr)_minmax(12rem,0.9fr)_2.25rem] md:items-center">
                <div className="flex items-center max-md:order-4">
                  {!readOnly ? (
                    <SortableItemHandle
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Drag ${block.label} to reorder`}
                        />
                      }
                    >
                      <GripVertical />
                    </SortableItemHandle>
                  ) : (
                    <GripVertical aria-hidden="true" />
                  )}
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <Select
                    value={
                      block.periodNumber === null
                        ? "CUSTOM"
                        : String(block.periodNumber)
                    }
                    disabled={readOnly}
                    onValueChange={(value) => {
                      if (value === "CUSTOM") {
                        update(index, {
                          periodNumber: null,
                          label: block.periodNumber
                            ? "Custom block"
                            : block.label,
                        });
                      } else {
                        const periodNumber = Number(value);
                        update(index, {
                          periodNumber,
                          label: `Period ${periodNumber}`,
                        });
                      }
                    }}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {Array.from({ length: 8 }, (_, periodIndex) => (
                        <SelectItem
                          key={periodIndex + 1}
                          index={periodIndex}
                          value={String(periodIndex + 1)}
                        >
                          Period {periodIndex + 1}
                        </SelectItem>
                      ))}
                      <SelectItem index={8} value="CUSTOM">
                        Custom block
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={`Label for block ${index + 1}`}
                    value={block.label}
                    disabled={readOnly}
                    onChange={(event) =>
                      update(index, { label: event.target.value })
                    }
                    className="h-8 min-w-0 bg-transparent"
                  />
                </div>

                <div className="flex min-w-0 items-center gap-1.5">
                  <Input
                    type="time"
                    aria-label={`${block.label} start time`}
                    value={block.startTime}
                    disabled={readOnly}
                    onChange={(event) =>
                      update(index, { startTime: event.target.value })
                    }
                    className="h-8 min-w-0 bg-transparent px-2 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="time"
                    aria-label={`${block.label} end time`}
                    value={block.endTime}
                    disabled={readOnly}
                    onChange={(event) =>
                      update(index, { endTime: event.target.value })
                    }
                    className="h-8 min-w-0 bg-transparent px-2 text-xs"
                  />
                </div>

                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100"
                    aria-label={`Remove ${block.label}`}
                    onClick={() =>
                      onChange(
                        blocks.filter((_, blockIndex) => blockIndex !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            </SortableItem>
          ))}
        </Sortable>

        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="m-2"
            leadingIcon={Plus}
            onClick={() => {
              const previousEnd = blocks.at(-1)?.endTime ?? "08:00";
              onChange([
                ...blocks,
                {
                  label: "Custom block",
                  periodNumber: null,
                  startTime: previousEnd,
                  endTime: addMinutes(previousEnd, 45),
                },
              ]);
            }}
          >
            Add block
          </Button>
        ) : null}
      </div>
      <PlanPreview blocks={blocks} />
    </div>
  );
}

function calendarDayState(workspace: AdminWorkspace, date: Date) {
  const dateKey = dateKeyFromDate(date);
  const weekday = date.getDay();
  const assignment = workspace.monthAssignments.find(
    (candidate) => candidate.dateKey === dateKey,
  );
  const inYear =
    !!workspace.academicYearStartDateKey &&
    !!workspace.academicYearEndDateKey &&
    dateKey >= workspace.academicYearStartDateKey &&
    dateKey <= workspace.academicYearEndDateKey;
  if (!inYear) return { label: "Outside year", detail: "Outside the configured academic year" };
  if (weekday === 0 || weekday === 6) return { label: "Weekend", detail: "Weekend" };
  if (assignment) {
    return {
      label: assignment.kind === "NO_SCHOOL" ? "No school" : assignment.name,
      detail: `${assignment.name} · ${assignment.mode === "LINKED" ? "linked template" : "custom plan"}`,
    };
  }
  if (weekday === 5) return { label: "Unassigned", detail: "Friday is unassigned" };
  const regular = workspace.templates.find(
    (template) => template.id === workspace.regularTemplateId,
  );
  return { label: "Default", detail: regular?.name ?? "Default template" };
}

function AdminCalendarDayButton({
  workspace,
  ...props
}: ComponentProps<typeof DayButton> & { workspace: AdminWorkspace }) {
  const state = calendarDayState(workspace, props.day.date);
  return (
    <Tooltip content={`${dateKeyFromDate(props.day.date)} · ${state.detail}`}>
      <CalendarDayButton {...props}>
        {props.day.date.getDate()}
        <span className="max-w-full truncate">{state.label}</span>
      </CalendarDayButton>
    </Tooltip>
  );
}

function DatePlanWorkspace({
  workspace,
  dateKey,
  onDateKeyChange,
  selectedTemplateId,
  onTemplateSelect,
  selectedApplyTemplate,
  pending,
  dateName,
  onDateNameChange,
  dateBlocks,
  onDateBlocksChange,
  regularTemplate,
  academicStart,
  onAcademicStartChange,
  academicEnd,
  onAcademicEndChange,
  onConfigureAcademicYear,
  onApplyTemplate,
  onSaveDate,
  onResetDate,
  onUnlinkTemplate,
}: {
  workspace: AdminWorkspace;
  dateKey: string;
  onDateKeyChange: (dateKey: string) => void;
  selectedTemplateId: string;
  onTemplateSelect: (templateId: string) => void;
  selectedApplyTemplate: DayTemplate | null;
  pending: string | null;
  dateName: string;
  onDateNameChange: (name: string) => void;
  dateBlocks: PlanBlock[];
  onDateBlocksChange: (blocks: PlanBlock[]) => void;
  regularTemplate: DayTemplate | null;
  academicStart: string;
  onAcademicStartChange: (dateKey: string) => void;
  academicEnd: string;
  onAcademicEndChange: (dateKey: string) => void;
  onConfigureAcademicYear: () => void;
  onApplyTemplate: () => void;
  onSaveDate: () => void;
  onResetDate: () => void;
  onUnlinkTemplate: () => void;
}) {
  const selectedDate = dateFromKey(dateKey);
  const weekday = selectedDate.getDay();
  const isWeekday = weekday >= 1 && weekday <= 5;
  const isInAcademicYear =
    !!workspace.academicYearStartDateKey &&
    !!workspace.academicYearEndDateKey &&
    dateKey >= workspace.academicYearStartDateKey &&
    dateKey <= workspace.academicYearEndDateKey;
  const canAssign = isWeekday && isInAcademicYear && !workspace.setupRequired;
  const selectedState = calendarDayState(workspace, selectedDate);

  return (
    <div className="flex flex-col gap-5 pt-5">
      {workspace.setupRequired ? (
        <Alert>
          <School />
          <AlertTitle>Academic year setup required</AlertTitle>
          <AlertDescription>
            The first administrator must set the school-year boundaries and required default template before dates can be assigned.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(21rem,0.82fr)_minmax(0,1.7fr)] xl:items-start">
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4">
          <section className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
            <header className="flex items-center justify-between gap-3 bg-surface-3 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">School calendar</h3>
                <p className="text-xs text-muted-foreground">Select a date to inspect or assign it.</p>
              </div>
              <Tooltip content="Monday–Thursday inherit the default template. Fridays remain unassigned until an administrator assigns one.">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="How schedule inheritance works">
                  <Info />
                </Button>
              </Tooltip>
            </header>
            <Calendar
              mode="single"
              selected={selectedDate}
              month={selectedDate}
              onSelect={(date) => date && onDateKeyChange(dateKeyFromDate(date))}
              onMonthChange={(date) =>
                onDateKeyChange(dateKeyFromDate(firstWeekdayInMonth(date)))
              }
              captionLayout="dropdown"
              startMonth={workspace.academicYearStartDateKey ? dateFromKey(workspace.academicYearStartDateKey) : undefined}
              endMonth={workspace.academicYearEndDateKey ? dateFromKey(workspace.academicYearEndDateKey) : undefined}
              className="w-full [--cell-size:clamp(2.75rem,5.5vw,3.75rem)]"
              classNames={{ root: "w-full", months: "w-full", month: "w-full", month_grid: "w-full" }}
              components={{
                DayButton: (props) => <AdminCalendarDayButton workspace={workspace} {...props} />,
              }}
            />
          </section>

          <section className="rounded-xl bg-surface-2 p-4 shadow-surface-1">
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Academic year</h3>
              <Tooltip content="These dates are deployment data, not code. Administrators set them again when a new production database is initialized.">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="About academic year setup"><Info /></Button>
              </Tooltip>
            </div>
            <FieldGroup className="gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="academic-year-start">First day</FieldLabel>
                  <Input id="academic-year-start" type="date" value={academicStart} onChange={(event) => onAcademicStartChange(event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="academic-year-end">Last day</FieldLabel>
                  <Input id="academic-year-end" type="date" value={academicEnd} onChange={(event) => onAcademicEndChange(event.target.value)} />
                </Field>
              </div>
              <FieldDescription>The default template is mandatory and applies to every in-range Monday–Thursday without an assignment.</FieldDescription>
              <Button type="button" size="sm" leadingIcon={Save} disabled={!regularTemplate || !academicStart || !academicEnd || pending !== null} onClick={onConfigureAcademicYear}>
                Save academic year
              </Button>
            </FieldGroup>
          </section>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
          <header className="flex flex-col gap-4 bg-surface-3 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{dateKey}</p>
                <h2 className="text-lg font-semibold text-foreground">{selectedState.detail}</h2>
              </div>
              {workspace.override?.mode === "LINKED" ? (
                <Badge size="sm" color="blue"><Link2 />Linked template</Badge>
              ) : workspace.override ? (
                <Badge size="sm" color="orange">Custom plan</Badge>
              ) : weekday === 5 && canAssign ? (
                <Badge size="sm" color="orange">Unassigned Friday</Badge>
              ) : canAssign ? (
                <Badge size="sm">Inherited default</Badge>
              ) : (
                <Badge size="sm">Not a school date</Badge>
              )}
            </div>

            {canAssign ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field className="max-w-xs gap-1.5">
                  <FieldLabel>Assign template</FieldLabel>
                  <Select value={selectedTemplateId} onValueChange={onTemplateSelect}>
                    <SelectTrigger placeholder="Choose template" />
                    <SelectContent>
                      <SelectGroup>
                        {workspace.templates.map((template, index) => (
                          <SelectItem key={template.id} index={index} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="button" variant="tertiary" size="sm" leadingIcon={CalendarPlus} disabled={!selectedApplyTemplate || pending !== null} loading={pending === "apply-date"} onClick={onApplyTemplate}>
                  Assign template
                </Button>
                <Tooltip content="Assignments stay linked: future edits to the template automatically update this date.">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="About linked assignments"><Info /></Button>
                </Tooltip>
              </div>
            ) : null}
          </header>

          <div className="flex flex-col gap-4 p-4 sm:p-5">
            {!canAssign ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
                  <EmptyTitle>Choose a school date</EmptyTitle>
                  <EmptyDescription>Select a weekday inside the configured academic year.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : workspace.override?.mode === "LINKED" ? (
              <>
                {workspace.override.kind === "NO_SCHOOL" ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><School /></EmptyMedia>
                      <EmptyTitle>No school</EmptyTitle>
                      <EmptyDescription>This linked template intentionally contains no schedule blocks.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <PlanBlockEditor blocks={dateBlocks} onChange={onDateBlocksChange} readOnly />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="tertiary" size="sm" leadingIcon={Unlink2} disabled={pending !== null} onClick={onUnlinkTemplate}>
                    Unlink and customize
                  </Button>
                  <Button type="button" variant="ghost" size="sm" leadingIcon={RotateCcw} disabled={pending !== null} onClick={onResetDate}>
                    {weekday === 5 ? "Return to unassigned" : "Return to default"}
                  </Button>
                </div>
              </>
            ) : workspace.override ? (
              <>
                <Field className="max-w-md gap-1.5">
                  <FieldLabel htmlFor="date-plan-name">Day label</FieldLabel>
                  <Input id="date-plan-name" value={dateName} onChange={(event) => onDateNameChange(event.target.value)} />
                </Field>
                {dateBlocks.length === 0 ? (
                  <Empty>
                    <EmptyHeader><EmptyMedia variant="icon"><School /></EmptyMedia><EmptyTitle>No school</EmptyTitle><EmptyDescription>This custom date has no schedule blocks.</EmptyDescription></EmptyHeader>
                    <EmptyContent><Button type="button" variant="tertiary" size="sm" onClick={() => onDateBlocksChange([{ label: "Custom block", periodNumber: null, startTime: "08:00", endTime: "08:45" }])}>Add a schedule block</Button></EmptyContent>
                  </Empty>
                ) : (
                  <PlanBlockEditor blocks={dateBlocks} onChange={onDateBlocksChange} />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" leadingIcon={Save} disabled={pending !== null} onClick={onSaveDate}>Save custom date</Button>
                  <Button type="button" variant="ghost" size="sm" leadingIcon={RotateCcw} disabled={pending !== null} onClick={onResetDate}>
                    {weekday === 5 ? "Return to unassigned" : "Return to default"}
                  </Button>
                </div>
              </>
            ) : weekday === 5 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><CalendarPlus /></EmptyMedia>
                  <EmptyTitle>Friday is unassigned</EmptyTitle>
                  <EmptyDescription>Choose a template above when the school publishes this Friday’s plan.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : regularTemplate ? (
              <PlanBlockEditor blocks={dateBlocks} onChange={onDateBlocksChange} readOnly />
            ) : (
              <Empty><EmptyHeader><EmptyTitle>Default template missing</EmptyTitle><EmptyDescription>Create a regular template before configuring the academic year.</EmptyDescription></EmptyHeader></Empty>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function TemplateWorkspace({
  workspace,
  selectedTemplateId,
  isNewTemplate,
  onTemplateSelect,
  onNewTemplate,
  templateName,
  onTemplateNameChange,
  templateKind,
  onTemplateKindChange,
  templateBlocks,
  onTemplateBlocksChange,
  pending,
  activeTemplate,
  onSaveTemplate,
  onSetRegular,
  onDeleteTemplate,
}: {
  workspace: AdminWorkspace;
  selectedTemplateId: string;
  isNewTemplate: boolean;
  onTemplateSelect: (templateId: string) => void;
  onNewTemplate: () => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
  templateKind: TemplateKind;
  onTemplateKindChange: (kind: TemplateKind) => void;
  templateBlocks: PlanBlock[];
  onTemplateBlocksChange: (blocks: PlanBlock[]) => void;
  pending: string | null;
  activeTemplate: DayTemplate | null;
  onSaveTemplate: () => void;
  onSetRegular: () => void;
  onDeleteTemplate: () => void;
}) {
  return (
    <div className="space-y-5 pt-5">
      <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3 shadow-surface-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Label className="text-xs">Template</Label>
          <Select
            value={isNewTemplate ? "__new__" : selectedTemplateId}
            onValueChange={onTemplateSelect}
          >
            <SelectTrigger placeholder="Choose template" />
            <SelectContent>
              <SelectGroup>
                {workspace.templates.map((template, index) => (
                  <SelectItem
                    key={template.id}
                    index={index}
                    value={template.id}
                  >
                    {template.name}
                  </SelectItem>
                ))}
                {isNewTemplate ? (
                  <SelectItem
                    index={workspace.templates.length}
                    value="__new__"
                  >
                    New template
                  </SelectItem>
                ) : null}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          leadingIcon={Plus}
          onClick={onNewTemplate}
        >
          New template
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-1.5">
          <Label htmlFor="template-name" className="text-xs">
            Template name
          </Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(event) => onTemplateNameChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select
            value={templateKind}
            onValueChange={(value) =>
              onTemplateKindChange(value as TemplateKind)
            }
          >
            <SelectTrigger />
            <SelectContent>
              <SelectGroup>
                <SelectItem index={0} value="REGULAR">
                  Regular
                </SelectItem>
                <SelectItem index={1} value="SPECIAL">
                  Special
                </SelectItem>
                <SelectItem index={2} value="NO_SCHOOL">
                  No school
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {templateKind === "NO_SCHOOL" ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><School /></EmptyMedia>
            <EmptyTitle>No schedule blocks</EmptyTitle>
            <EmptyDescription>A no-school template resolves directly to a closed school day.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <PlanBlockEditor
          blocks={templateBlocks}
          onChange={onTemplateBlocksChange}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          leadingIcon={Save}
          disabled={pending !== null}
          onClick={onSaveTemplate}
        >
          Save template
        </Button>
        {!isNewTemplate && activeTemplate?.kind === "REGULAR" ? (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            disabled={
              workspace.regularTemplateId === activeTemplate.id ||
              pending !== null
            }
            onClick={onSetRegular}
          >
            Make regular
          </Button>
        ) : null}
        {!isNewTemplate && activeTemplate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            leadingIcon={Trash2}
            disabled={pending !== null}
            onClick={onDeleteTemplate}
          >
            Delete
          </Button>
        ) : null}
        {workspace.regularTemplateId === activeTemplate?.id ? (
          <Badge size="sm">Current regular template</Badge>
        ) : null}
      </div>
    </div>
  );
}

export function ManageBlocksPanel() {
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"dates" | "templates">("dates");
  const [dateKey, setDateKey] = useState(schoolDateKey);
  const workspace = useQuery(
    api.schedule.dayPlans.getAdminWorkspace,
    isAuthenticated ? { dateKey } : "skip",
  );
  const saveTemplate = useMutation(api.schedule.dayPlans.saveTemplate);
  const setRegularTemplate = useMutation(
    api.schedule.dayPlans.setRegularTemplate,
  );
  const deleteTemplate = useMutation(api.schedule.dayPlans.deleteTemplate);
  const configureAcademicYear = useMutation(
    api.schedule.dayPlans.configureAcademicYear,
  );
  const applyTemplate = useMutation(api.schedule.dayPlans.applyTemplateToDate);
  const unlinkDateTemplate = useMutation(
    api.schedule.dayPlans.unlinkDateTemplate,
  );
  const saveDateOverride = useMutation(api.schedule.dayPlans.saveDateOverride);
  const resetDateOverride = useMutation(
    api.schedule.dayPlans.resetDateOverride,
  );

  const [pending, setPending] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateKind, setTemplateKind] = useState<TemplateKind>("SPECIAL");
  const [templateBlocks, setTemplateBlocks] =
    useState<PlanBlock[]>(EMPTY_BLOCKS);
  const [dateName, setDateName] = useState("");
  const [dateBlocks, setDateBlocks] = useState<PlanBlock[]>(EMPTY_BLOCKS);
  const [academicStart, setAcademicStart] = useState("");
  const [academicEnd, setAcademicEnd] = useState("");

  const activeTemplate = useMemo(
    () =>
      workspace?.templates.find(
        (template) => template.id === selectedTemplateId,
      ) ?? null,
    [selectedTemplateId, workspace?.templates],
  );
  const regularTemplate = useMemo(
    () =>
      workspace?.templates.find(
        (template) => template.id === workspace.regularTemplateId,
      ) ?? null,
    [workspace],
  );

  useEffect(() => {
    if (!workspace || isNewTemplate) return;
    const nextTemplate =
      workspace.templates.find(
        (template) => template.id === selectedTemplateId,
      ) ??
      regularTemplate ??
      workspace.templates[0];
    if (!nextTemplate) return;
    if (selectedTemplateId !== nextTemplate.id)
      setSelectedTemplateId(nextTemplate.id);
    setTemplateName(nextTemplate.name);
    setTemplateKind(nextTemplate.kind);
    setTemplateBlocks(toPlanBlocks(nextTemplate.blocks));
  }, [isNewTemplate, regularTemplate, selectedTemplateId, workspace]);

  useEffect(() => {
    if (!workspace) return;
    if (workspace.override) {
      setDateName(workspace.override.name);
      setDateBlocks(toPlanBlocks(workspace.override.blocks));
    } else {
      setDateName(regularTemplate?.name ?? "Regular schedule");
      setDateBlocks(
        dateFromKey(workspace.dateKey).getDay() === 5
          ? EMPTY_BLOCKS
          : toPlanBlocks(regularTemplate?.blocks ?? []),
      );
    }
  }, [regularTemplate, workspace]);

  useEffect(() => {
    if (!workspace) return;
    setAcademicStart(workspace.academicYearStartDateKey ?? "");
    setAcademicEnd(workspace.academicYearEndDateKey ?? "");
  }, [workspace?.academicYearEndDateKey, workspace?.academicYearStartDateKey]);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ) => {
    try {
      setPending(key);
      await action();
      toast({ title: success });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  };

  const selectedApplyTemplate = activeTemplate ?? regularTemplate;

  return (
    <div className="space-y-5">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "dates" | "templates")}
      >
        <TabsList>
          <TabItem value="dates" label="Calendar dates" icon={CalendarDays} />
          <TabItem value="templates" label="Templates" icon={LayoutTemplate} />
        </TabsList>

        {workspace === undefined ? (
          <div className="mt-5 h-48 animate-pulse rounded-xl bg-muted/30" />
        ) : (
          <>
            <TabPanel value="dates">
              <DatePlanWorkspace
                workspace={workspace}
                dateKey={dateKey}
                onDateKeyChange={setDateKey}
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={(templateId) => {
                  setSelectedTemplateId(templateId);
                  setIsNewTemplate(false);
                }}
                selectedApplyTemplate={selectedApplyTemplate}
                pending={pending}
                dateName={dateName}
                onDateNameChange={setDateName}
                dateBlocks={dateBlocks}
                onDateBlocksChange={setDateBlocks}
                regularTemplate={regularTemplate}
                academicStart={academicStart}
                onAcademicStartChange={setAcademicStart}
                academicEnd={academicEnd}
                onAcademicEndChange={setAcademicEnd}
                onConfigureAcademicYear={() => {
                  if (!regularTemplate) return;
                  void run(
                    "configure-year",
                    () =>
                      configureAcademicYear({
                        startDateKey: academicStart,
                        endDateKey: academicEnd,
                        regularTemplateId: regularTemplate.id,
                      }),
                    "Academic year saved",
                  );
                }}
                onApplyTemplate={() => {
                  if (!selectedApplyTemplate) return;
                  void run(
                    "apply-date",
                    () =>
                      applyTemplate({
                        dateKey,
                        templateId: selectedApplyTemplate.id,
                      }),
                    "Template linked to date",
                  );
                }}
                onSaveDate={() =>
                  void run(
                    "save-date",
                    () =>
                      saveDateOverride({
                        overrideId: workspace.override?.id,
                        dateKey,
                        name: dateName,
                        sourceTemplateId:
                          workspace.override?.sourceTemplateId ?? null,
                        blocks: dateBlocks,
                      }),
                    "Date schedule saved",
                  )
                }
                onUnlinkTemplate={() =>
                  void run(
                    "unlink-date",
                    () => unlinkDateTemplate({ dateKey }),
                    "Template unlinked; this date can now be customized",
                  )
                }
                onResetDate={() =>
                  void run(
                    "reset-date",
                    () => resetDateOverride({ dateKey }),
                    dateFromKey(dateKey).getDay() === 5
                      ? "Friday returned to unassigned"
                      : "Date returned to the default template",
                  )
                }
              />
            </TabPanel>
            <TabPanel value="templates">
              <TemplateWorkspace
                workspace={workspace}
                selectedTemplateId={selectedTemplateId}
                isNewTemplate={isNewTemplate}
                onTemplateSelect={(templateId) => {
                  if (templateId === "__new__") return;
                  setIsNewTemplate(false);
                  setSelectedTemplateId(templateId);
                }}
                onNewTemplate={() => {
                  setIsNewTemplate(true);
                  setTemplateName("New special day");
                  setTemplateKind("SPECIAL");
                  setTemplateBlocks(
                    dateBlocks.length > 0 ? [...dateBlocks] : EMPTY_BLOCKS,
                  );
                }}
                templateName={templateName}
                onTemplateNameChange={setTemplateName}
                templateKind={templateKind}
                onTemplateKindChange={(kind) => {
                  setTemplateKind(kind);
                  if (kind === "NO_SCHOOL") setTemplateBlocks(EMPTY_BLOCKS);
                }}
                templateBlocks={templateBlocks}
                onTemplateBlocksChange={setTemplateBlocks}
                pending={pending}
                activeTemplate={activeTemplate}
                onSaveTemplate={() =>
                  void run(
                    "save-template",
                    async () => {
                      const saved = await saveTemplate({
                        templateId: isNewTemplate
                          ? undefined
                          : activeTemplate?.id,
                        name: templateName,
                        kind: templateKind,
                        blocks:
                          templateKind === "NO_SCHOOL"
                            ? EMPTY_BLOCKS
                            : templateBlocks,
                      });
                      setSelectedTemplateId(saved.id);
                      setIsNewTemplate(false);
                    },
                    "Template saved",
                  )
                }
                onSetRegular={() => {
                  if (!activeTemplate) return;
                  void run(
                    "set-regular",
                    () => setRegularTemplate({ templateId: activeTemplate.id }),
                    "Regular template updated",
                  );
                }}
                onDeleteTemplate={() => {
                  if (!activeTemplate) return;
                  void run(
                    "delete-template",
                    async () => {
                      await deleteTemplate({ templateId: activeTemplate.id });
                      setSelectedTemplateId("");
                    },
                    "Template deleted",
                  );
                }}
              />
            </TabPanel>
          </>
        )}
      </Tabs>
    </div>
  );
}
