import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { useMutation, useQuery } from "@/lib/convex-react";
import type { FunctionReturnType } from "convex/server";
import { Clock3, Pencil, Plus, Trash2 } from "lucide-react-native";
import { Screen } from "@/components/screen";
import {
  Button,
  ChipGroup,
  Empty,
  IconButton,
  Section,
  SegmentedControl,
  Sheet,
  SkeletonList,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const weekdayLabels: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
};
const weekdayShortLabels: Record<Weekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
};
const periods = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
const blockKinds = [
  { label: "Period", value: "PERIOD" },
  { label: "Custom", value: "CUSTOM" },
] as const;

type Weekday = (typeof weekdays)[number];
type BlockKind = (typeof blockKinds)[number]["value"];
type ScheduleDashboard = FunctionReturnType<typeof api.schedule.dashboard.get>;
type SchoolDayBlock = ScheduleDashboard["blocks"][number];
type BlockForm = {
  kind: BlockKind;
  periodNumber: string;
  label: string;
  startTime: string;
  endTime: string;
};

export function SchoolDayScreen() {
  const data = useQuery(api.schedule.dashboard.get, {});
  const createBlock = useMutation(api.schedule.blocks.createBlock);
  const updateBlock = useMutation(api.schedule.blocks.updateBlock);
  const deleteBlock = useMutation(api.schedule.blocks.deleteBlock);
  const [weekday, setWeekday] = useState<Weekday>(currentWeekday);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<SchoolDayBlock | null>(null);
  const [form, setForm] = useState<BlockForm>(() => defaultForm([]));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { showToast } = useToast();

  const blocks = useMemo(
    () => (data?.blocks ?? [])
      .filter((block) => block.weekday === weekday)
      .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [data?.blocks, weekday],
  );

  function selectWeekday(nextWeekday: Weekday) {
    if (pendingKey) return;
    setWeekday(nextWeekday);
    setSheetOpen(false);
    setEditingBlock(null);
  }

  function openCreate() {
    setEditingBlock(null);
    setForm(defaultForm(blocks));
    setSheetOpen(true);
  }

  function openEdit(block: SchoolDayBlock) {
    setEditingBlock(block);
    setForm({
      kind: block.periodNumber ? "PERIOD" : "CUSTOM",
      periodNumber: String(block.periodNumber ?? 1),
      label: block.periodNumber ? "" : block.label,
      startTime: block.startTime,
      endTime: block.endTime,
    });
    setSheetOpen(true);
  }

  function closeSheet() {
    if (pendingKey) return;
    setSheetOpen(false);
    setEditingBlock(null);
  }

  async function submit() {
    if (pendingKey) return;
    const error = validateForm(form);
    if (error) {
      showToast({ title: error, tone: "warning" });
      return;
    }

    const key = editingBlock ? `update:${editingBlock.id}` : "create";
    setPendingKey(key);
    try {
      const payload = {
        weekday,
        kind: form.kind,
        periodNumber: form.kind === "PERIOD" ? Number(form.periodNumber) : undefined,
        label: form.kind === "CUSTOM" ? form.label.trim() : undefined,
        startTime: form.startTime.trim(),
        endTime: form.endTime.trim(),
      };

      if (editingBlock) {
        await updateBlock({ blockId: editingBlock.id, ...payload });
      } else {
        await createBlock(payload);
      }

      showToast({
        title: editingBlock ? "Block updated" : "Block added",
        tone: "success",
      });
      setSheetOpen(false);
      setEditingBlock(null);
    } catch (error) {
      showToast({
        title: editingBlock ? "Block wasn't updated" : "Block wasn't added",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setPendingKey(null);
    }
  }

  function confirmDelete(block: SchoolDayBlock) {
    if (pendingKey) return;
    Alert.alert(
      `Delete ${block.label}?`,
      `${weekdayLabels[block.weekday]} schedules will no longer include this block.`,
      [
        { text: "Keep block", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void remove(block),
        },
      ],
    );
  }

  async function remove(block: SchoolDayBlock) {
    const key = `delete:${block.id}`;
    setPendingKey(key);
    try {
      await deleteBlock({ blockId: block.id });
      showToast({ title: "Block deleted", tone: "success" });
      if (editingBlock?.id === block.id) closeSheet();
    } catch (error) {
      showToast({
        title: "Block wasn't deleted",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setPendingKey(null);
    }
  }

  const duration = durationMinutes(form.startTime, form.endTime);

  return (
    <Screen title="School day">
      <ChipGroup
        values={weekdays}
        selected={[weekday]}
        labels={weekdayShortLabels}
        onToggle={selectWeekday}
      />

      <Section
        title={weekdayLabels[weekday]}
        action={
          <Button
            title="Add block"
            size="sm"
            variant="tertiary"
            icon={Plus}
            disabled={!!pendingKey}
            onPress={openCreate}
          />
        }
      >
        {data === undefined ? (
          <SkeletonList count={6} />
        ) : blocks.length ? (
          <BlockList
            blocks={blocks}
            pendingKey={pendingKey}
            onEdit={openEdit}
            onDelete={confirmDelete}
          />
        ) : (
          <Empty
            icon={Clock3}
            title={`No ${weekdayLabels[weekday]} blocks`}
            body="Add the first block for this day."
          />
        )}
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingBlock ? "Edit block" : "New block"}
        snapPoints={["72%", "90%"]}
      >
        <View style={{ gap: spacing.sm }}>
          <Txt variant="label">Block type</Txt>
          <SegmentedControl
            segments={blockKinds}
            value={form.kind}
            onChange={(kind) => setForm((current) => ({ ...current, kind }))}
          />
        </View>

        {form.kind === "PERIOD" ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="label">Period number</Txt>
            <ChipGroup
              values={periods}
              selected={[form.periodNumber as (typeof periods)[number]]}
              onToggle={(periodNumber) => setForm((current) => ({ ...current, periodNumber }))}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="label">Label</Txt>
            <TextField
              value={form.label}
              onChangeText={(label) => setForm((current) => ({ ...current, label }))}
              placeholder="Lunch, advisory, assembly…"
              maxLength={48}
            />
          </View>
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Txt variant="label">Starts</Txt>
            <TextField
              value={form.startTime}
              onChangeText={(startTime) => setForm((current) => ({ ...current, startTime }))}
              placeholder="08:10"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Txt variant="label">Ends</Txt>
            <TextField
              value={form.endTime}
              onChangeText={(endTime) => setForm((current) => ({ ...current, endTime }))}
              placeholder="08:55"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              maxLength={5}
            />
          </View>
        </View>

        <Txt variant="caption" tone={duration > 0 ? "muted" : "destructive"}>
          {duration > 0 ? `${duration} minutes` : "End time must be after start time."}
        </Txt>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button
            title="Cancel"
            variant="tertiary"
            disabled={!!pendingKey}
            onPress={closeSheet}
            style={{ flex: 1 }}
          />
          <Button
            title={editingBlock ? "Save" : "Add"}
            loading={pendingKey === (editingBlock ? `update:${editingBlock.id}` : "create")}
            disabled={!!pendingKey}
            onPress={() => void submit()}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function BlockList({
  blocks,
  pendingKey,
  onEdit,
  onDelete,
}: {
  blocks: SchoolDayBlock[];
  pendingKey: string | null;
  onEdit: (block: SchoolDayBlock) => void;
  onDelete: (block: SchoolDayBlock) => void;
}) {
  const { color } = useTheme();

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: radii.lg,
        backgroundColor: color("secondary"),
        paddingHorizontal: spacing.md,
      }}
    >
      {blocks.map((block, index) => (
        <View
          key={block.id}
          style={{
            minHeight: 68,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            borderTopWidth: index ? 1 : 0,
            borderTopColor: color("border"),
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt variant="section" numberOfLines={1}>
              {block.label}
            </Txt>
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {formatClock(block.startTime)}–{formatClock(block.endTime)} · {block.durationMinutes} min
            </Txt>
          </View>
          <IconButton
            icon={Pencil}
            label={`Edit ${block.label}`}
            size="sm"
            variant="ghost"
            disabled={!!pendingKey}
            onPress={() => onEdit(block)}
          />
          <IconButton
            icon={Trash2}
            label={`Delete ${block.label}`}
            size="sm"
            variant="destructive"
            disabled={!!pendingKey}
            onPress={() => onDelete(block)}
          />
        </View>
      ))}
    </View>
  );
}

function defaultForm(blocks: SchoolDayBlock[]): BlockForm {
  const ordered = [...blocks].sort((left, right) => left.startTime.localeCompare(right.startTime));
  const last = ordered[ordered.length - 1];
  const usedPeriods = new Set(ordered.flatMap((block) => block.periodNumber ? [block.periodNumber] : []));
  const nextPeriod = periods.find((period) => !usedPeriods.has(Number(period))) ?? "1";
  const startTime = last?.endTime ?? "08:10";

  return {
    kind: "PERIOD",
    periodNumber: nextPeriod,
    label: "",
    startTime,
    endTime: addMinutes(startTime, 45),
  };
}

function validateForm(form: BlockForm) {
  if (form.kind === "CUSTOM" && !form.label.trim()) return "Add a label for this block";
  if (!isTime(form.startTime) || !isTime(form.endTime)) return "Use 24-hour times like 08:10";
  if (durationMinutes(form.startTime, form.endTime) <= 0) return "End time must be after start time";
  return null;
}

function currentWeekday(): Weekday {
  const index = new Date().getDay() - 1;
  return weekdays[index] ?? "MONDAY";
}

function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function timeToMinutes(value: string) {
  if (!isTime(value)) return Number.NaN;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function durationMinutes(startTime: string, endTime: string) {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Number.isFinite(duration) ? duration : 0;
}

function addMinutes(value: string, minutes: number) {
  const total = Math.min(timeToMinutes(value) + minutes, 23 * 60 + 59);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
