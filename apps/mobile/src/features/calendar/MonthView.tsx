import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import {
  Button,
  ChipGroup,
  IconButton,
  Sheet,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { timeRange } from "@/lib/format";
import { warning } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const sources = ["DISTRICT", "SCHOOL", "CLUB", "FLEX_FRIDAY", "PERSONAL"] as const;
const sourceFilterLabels: Record<(typeof sources)[number], string> = {
  DISTRICT: "District",
  SCHOOL: "School",
  CLUB: "Clubs",
  FLEX_FRIDAY: "Flex",
  PERSONAL: "Personal",
};
const sourceDisplayLabels = { ...sourceFilterLabels, CLUB: "Club" };

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function MonthView() {
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeSources, setActiveSources] = useState<(typeof sources)[number][]>([
    ...sources,
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    location: "",
    description: "",
  });
  const [startAt, setStartAt] = useState<Date | undefined>(undefined);
  const range = monthRange(offset);
  const entries = useQuery(api.events.calendar.list, {
    startDate: range.start.getTime(),
    endDate: range.end.getTime(),
    sources: activeSources,
  });
  const createEntry = useMutation(api.events.calendar.create);
  const removeEntry = useMutation(api.events.calendar.remove);
  const { showToast } = useToast();

  const filteredEntries = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (entries ?? []).filter((entry: any) => {
      if (!search) return true;
      return [entry.title, entry.description, entry.location, entry.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [entries, query]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const entry of filteredEntries) {
      const key = new Date(entry.startAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [filteredEntries]);

  async function submit() {
    if (!form.title.trim() || !startAt) {
      showToast({ title: "Add a title and valid date" });
      return;
    }
    try {
      await createEntry({
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt: startAt.getTime(),
        source: "PERSONAL",
      });
      setForm({ title: "", location: "", description: "" });
      setStartAt(undefined);
      setShowCreate(false);
      showToast({ title: "Added to calendar", tone: "success" });
    } catch (error) {
      showToast({
        title: "Entry not added",
        body: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  function toggleSource(source: (typeof sources)[number]) {
    setActiveSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source],
    );
  }

  function confirmDelete(entry: any) {
    void warning();
    Alert.alert(`Delete “${entry.title}”?`, undefined, [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          removeEntry({ entryId: entry._id }).catch((error) =>
            showToast({
              title: "Entry not deleted",
              body: error instanceof Error ? error.message : "Try again.",
            }),
          ),
      },
    ]);
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <IconButton
            icon={ChevronLeft}
            label="Previous month"
            variant="ghost"
            onPress={() => setOffset((value) => value - 1)}
          />
          <Txt variant="section" style={{ flex: 1, textAlign: "center" }}>
            {range.start.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </Txt>
          <IconButton
            icon={ChevronRight}
            label="Next month"
            variant="ghost"
            onPress={() => setOffset((value) => value + 1)}
          />
        </View>

        <TextField value={query} onChangeText={setQuery} placeholder="Search this month" />

        <View
          style={{
            gap: spacing.sm,
          }}
        >
          <ChipGroup
            values={sources}
            selected={activeSources}
            labels={sourceFilterLabels}
            onToggle={toggleSource}
          />
          <Button
            title="Add"
            size="sm"
            variant="tertiary"
            icon={Plus}
            onPress={() => setShowCreate(true)}
            style={{ alignSelf: "flex-end" }}
          />
        </View>
      </View>

      <DataBoundary data={entries} emptyTitle="Nothing this month">
        {() =>
          groupedEntries.length ? (
            <View style={{ gap: spacing.lg }}>
              {groupedEntries.map(([date, dateEntries]) => (
                <CalendarDayGroup
                  key={date}
                  date={new Date(date)}
                  entries={dateEntries}
                  onDelete={confirmDelete}
                />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <Txt tone="muted">No matches.</Txt>
            </View>
          )
        }
      </DataBoundary>

      <Sheet open={showCreate} onClose={() => setShowCreate(false)} title="Add to calendar">
        <TextField
          value={form.title}
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          placeholder="Title"
        />
        <DateTimePicker
          value={startAt}
          onChange={setStartAt}
          mode="datetime"
          placeholder="Starts"
        />
        <TextField
          value={form.location}
          onChangeText={(location) => setForm((current) => ({ ...current, location }))}
          placeholder="Location (optional)"
        />
        <TextField
          value={form.description}
          onChangeText={(description) =>
            setForm((current) => ({ ...current, description }))
          }
          placeholder="Notes (optional)"
          multiline
        />
        <Button title="Add" onPress={submit} />
      </Sheet>
    </View>
  );
}

function CalendarDayGroup({
  date,
  entries,
  onDelete,
}: {
  date: Date;
  entries: any[];
  onDelete: (entry: any) => void;
}) {
  const { color } = useTheme();
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const calendarDate = date
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();

  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="overline" tone="muted">
        {weekday} · {calendarDate}
      </Txt>
      <View
        style={{
          overflow: "hidden",
          borderRadius: radii.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: color("border"),
          backgroundColor: color("card"),
        }}
      >
        {entries.map((entry, index) => (
          <CalendarEntryRow
            key={entry._id}
            entry={entry}
            last={index === entries.length - 1}
            onDelete={() => onDelete(entry)}
          />
        ))}
      </View>
    </View>
  );
}

function CalendarEntryRow({
  entry,
  last,
  onDelete,
}: {
  entry: any;
  last: boolean;
  onDelete: () => void;
}) {
  const { color } = useTheme();
  const source =
    sourceDisplayLabels[entry.source as keyof typeof sourceDisplayLabels] ?? entry.source;
  const details = [
    timeRange(entry.startAt, entry.endAt).replace(" - ", "–"),
    entry.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        minHeight: spacing.xl * 3,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderColor: color("border"),
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {source}
          {entry.tags?.[0] ? ` · ${entry.tags[0]}` : ""}
        </Txt>
        <Txt variant="label" numberOfLines={2}>
          {entry.title}
        </Txt>
        {details ? (
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {details}
          </Txt>
        ) : null}
        {entry.description ? (
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {entry.description}
          </Txt>
        ) : null}
      </View>
      {entry.source === "PERSONAL" ? (
        <IconButton
          icon={Trash2}
          label={`Delete ${entry.title}`}
          size="sm"
          variant="ghost"
          onPress={onDelete}
        />
      ) : null}
    </View>
  );
}


