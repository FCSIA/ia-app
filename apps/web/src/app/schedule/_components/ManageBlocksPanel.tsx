"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { TabPanel } from "@/components/ui/tabs";
import { formatScheduleTime } from "@/components/schedule/schedule-utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "~/apps/convex/src/_generated/api";

type PlanBlock = FunctionArgs<
  typeof api.schedule.dayPlans.saveDateOverride
>["blocks"][number];
type TemplateKind = FunctionArgs<
  typeof api.schedule.dayPlans.saveTemplate
>["kind"];

const EMPTY_BLOCKS: PlanBlock[] = [];

function schoolDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function shiftDateKey(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
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
            {blocks.map((block, index) => (
              <div
                key={`${index}:${block.periodNumber ?? "custom"}`}
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
        <div className="divide-y divide-border/40">
          {blocks.map((block, index) => (
            <div
              key={`${index}:${block.periodNumber ?? "custom"}`}
              className="group grid gap-2 px-3 py-3 md:grid-cols-[2.25rem_minmax(8rem,1fr)_minmax(12rem,0.9fr)_2.25rem] md:items-center"
            >
              <div className="flex items-center gap-0.5 max-md:order-4">
                <GripVertical
                  className="size-3.5 text-muted-foreground/60"
                  aria-hidden="true"
                />
                {!readOnly ? (
                  <div className="flex md:flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      aria-label={`Move ${block.label} earlier`}
                      disabled={index === 0}
                      onClick={() =>
                        onChange(reorderBlockIdentity(blocks, index, index - 1))
                      }
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      aria-label={`Move ${block.label} later`}
                      disabled={index === blocks.length - 1}
                      onClick={() =>
                        onChange(reorderBlockIdentity(blocks, index, index + 1))
                      }
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
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
                  <SelectTrigger className="h-8 min-w-0 w-full" />
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
                  <Trash2 className="size-3.5" />
                </Button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="m-2"
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
            <Plus className="size-3.5" />
            Add block
          </Button>
        ) : null}
      </div>
      <PlanPreview blocks={blocks} />
    </div>
  );
}

export function ManageBlocksPanel() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"dates" | "templates">("dates");
  const [dateKey, setDateKey] = useState(schoolDateKey);
  const workspace = useQuery(api.schedule.dayPlans.getAdminWorkspace, {
    dateKey,
  });
  const saveTemplate = useMutation(api.schedule.dayPlans.saveTemplate);
  const setRegularTemplate = useMutation(
    api.schedule.dayPlans.setRegularTemplate,
  );
  const deleteTemplate = useMutation(api.schedule.dayPlans.deleteTemplate);
  const applyTemplate = useMutation(api.schedule.dayPlans.applyTemplateToDate);
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
      setDateBlocks(toPlanBlocks(regularTemplate?.blocks ?? []));
    }
  }, [regularTemplate, workspace]);

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
    <TabPanel value="admin" className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 shadow-surface-1">
          <Button
            type="button"
            variant={mode === "dates" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("dates")}
          >
            Calendar dates
          </Button>
          <Button
            type="button"
            variant={mode === "templates" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("templates")}
          >
            Templates
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Times are school-local (America/New_York).
        </p>
      </div>

      {workspace === undefined ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/30" />
      ) : mode === "dates" ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3 shadow-surface-1 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="admin-schedule-date" className="text-xs">
                  School date
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous date"
                    onClick={() => setDateKey(shiftDateKey(dateKey, -1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Input
                    id="admin-schedule-date"
                    type="date"
                    value={dateKey}
                    onChange={(event) => {
                      if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value))
                        setDateKey(event.target.value);
                    }}
                    className="h-8 w-[9.25rem]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next date"
                    onClick={() => setDateKey(shiftDateKey(dateKey, 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Clone a template</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={(value) => {
                    setSelectedTemplateId(value);
                    setIsNewTemplate(false);
                  }}
                >
                  <SelectTrigger
                    className="h-8 min-w-[13rem]"
                    placeholder="Choose template"
                  />
                  <SelectContent>
                    {workspace.templates.map((template, index) => (
                      <SelectItem
                        key={template.id}
                        index={index}
                        value={template.id}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                disabled={!selectedApplyTemplate || pending !== null}
                onClick={() => {
                  if (!selectedApplyTemplate) return;
                  void run(
                    "apply-date",
                    () =>
                      applyTemplate({
                        dateKey,
                        templateId: selectedApplyTemplate.id,
                      }),
                    "Template copied to date",
                  );
                }}
              >
                <Copy className="size-3.5" />
                {workspace.override ? "Replace override" : "Customize date"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {workspace.override ? (
                <Badge color="orange" size="sm">
                  Date override
                </Badge>
              ) : (
                <Badge size="sm">Uses regular template</Badge>
              )}
              <CalendarClock className="size-4 text-muted-foreground" />
            </div>
          </div>

          {workspace.override ? (
            <div className="space-y-4">
              <div className="max-w-md space-y-1.5">
                <Label htmlFor="date-plan-name" className="text-xs">
                  Day label
                </Label>
                <Input
                  id="date-plan-name"
                  value={dateName}
                  onChange={(event) => setDateName(event.target.value)}
                />
              </div>
              <PlanBlockEditor blocks={dateBlocks} onChange={setDateBlocks} />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending !== null}
                  onClick={() =>
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
                >
                  <Save className="size-3.5" />
                  Save date
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending !== null}
                  onClick={() =>
                    void run(
                      "reset-date",
                      () => resetDateOverride({ dateKey }),
                      "Date reset to regular schedule",
                    )
                  }
                >
                  <RotateCcw className="size-3.5" />
                  Reset override
                </Button>
              </div>
            </div>
          ) : regularTemplate ? (
            <PlanBlockEditor
              blocks={dateBlocks}
              onChange={setDateBlocks}
              readOnly
            />
          ) : (
            <div className="rounded-xl bg-surface-2 px-4 py-10 text-center shadow-surface-1">
              <p className="text-sm font-medium text-foreground">
                No regular template is configured.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a regular template, then make it the default.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3 shadow-surface-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select
                value={isNewTemplate ? "__new__" : selectedTemplateId}
                onValueChange={(value) => {
                  if (value === "__new__") return;
                  setIsNewTemplate(false);
                  setSelectedTemplateId(value);
                }}
              >
                <SelectTrigger
                  className="h-8 min-w-[15rem]"
                  placeholder="Choose template"
                />
                <SelectContent>
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
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => {
                setIsNewTemplate(true);
                setTemplateName("New special day");
                setTemplateKind("SPECIAL");
                setTemplateBlocks(
                  dateBlocks.length > 0 ? [...dateBlocks] : EMPTY_BLOCKS,
                );
              }}
            >
              <Plus className="size-3.5" />
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
                onChange={(event) => setTemplateName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={templateKind}
                onValueChange={(value) =>
                  setTemplateKind(value as TemplateKind)
                }
              >
                <SelectTrigger className="w-full" />
                <SelectContent>
                  <SelectItem index={0} value="REGULAR">
                    Regular
                  </SelectItem>
                  <SelectItem index={1} value="SPECIAL">
                    Special
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <PlanBlockEditor
            blocks={templateBlocks}
            onChange={setTemplateBlocks}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending !== null}
              onClick={() =>
                void run(
                  "save-template",
                  async () => {
                    const saved = await saveTemplate({
                      templateId: isNewTemplate
                        ? undefined
                        : activeTemplate?.id,
                      name: templateName,
                      kind: templateKind,
                      blocks: templateBlocks,
                    });
                    setSelectedTemplateId(saved.id);
                    setIsNewTemplate(false);
                  },
                  "Template saved",
                )
              }
            >
              <Save className="size-3.5" />
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
                onClick={() =>
                  void run(
                    "set-regular",
                    () => setRegularTemplate({ templateId: activeTemplate.id }),
                    "Regular template updated",
                  )
                }
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
                disabled={pending !== null}
                onClick={() =>
                  void run(
                    "delete-template",
                    async () => {
                      await deleteTemplate({ templateId: activeTemplate.id });
                      setSelectedTemplateId("");
                    },
                    "Template deleted",
                  )
                }
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : null}
            {workspace.regularTemplateId === activeTemplate?.id ? (
              <Badge size="sm">Current regular template</Badge>
            ) : null}
          </div>
        </div>
      )}
    </TabPanel>
  );
}
