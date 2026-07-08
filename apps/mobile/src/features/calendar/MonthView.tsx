import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  IconButton,
  ListRow,
  Section,
  Sheet,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { shortDate, timeRange } from "@/lib/format";
import { spacing } from "@/lib/tokens";
import { warning } from "@/lib/haptics";
import { api } from "~/apps/convex/src/_generated/api";

const sources = ["DISTRICT", "SCHOOL", "CLUB", "FLEX_FRIDAY", "PERSONAL"] as const;

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function sourceColor(source: string) {
  if (source === "PERSONAL") return "emerald";
  if (source === "CLUB") return "blue";
  if (source === "FLEX_FRIDAY") return "orange";
  if (source === "DISTRICT") return "violet";
  return "amber";
}

export function MonthView() {
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeSources, setActiveSources] = useState<(typeof sources)[number][]>([...sources]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", description: "" });
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

  async function submit() {
    const dateTime = parseLocalDateTime(form.date, form.time);
    if (!form.title.trim() || !dateTime) {
      showToast({ title: "Add a title and date", body: "Use YYYY-MM-DD and optional HH:mm time." });
      return;
    }
    try {
      await createEntry({
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt: dateTime,
        source: "PERSONAL",
      });
      setForm({ title: "", date: "", time: "", location: "", description: "" });
      setShowCreate(false);
      showToast({ title: "Entry added", tone: "success" });
    } catch (error) {
      showToast({ title: "Could not add entry", body: error instanceof Error ? error.message : "Try again." });
    }
  }

  function toggleSource(source: (typeof sources)[number]) {
    setActiveSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source],
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <IconButton icon={ChevronLeft} label="Previous month" onPress={() => setOffset((value) => value - 1)} />
          <Txt variant="section" style={{ flex: 1, textAlign: "center" }}>
            {range.start.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </Txt>
          <IconButton icon={ChevronRight} label="Next month" onPress={() => setOffset((value) => value + 1)} />
        </View>
        <TextField value={query} onChangeText={setQuery} placeholder="Search entries" />
        <ChipGroup
          values={sources}
          selected={activeSources}
          labels={Object.fromEntries(sources.map((source) => [source, source.replaceAll("_", " ")])) as Record<(typeof sources)[number], string>}
          onToggle={toggleSource}
        />
        <Button title="Add personal entry" variant="tertiary" icon={Plus} onPress={() => setShowCreate(true)} />
      </Card>

      <DataBoundary data={entries} emptyTitle="No calendar entries">
        {() => (
          <Section title="Entries">
            {filteredEntries.length === 0 ? (
              <Card variant="flat">
                <Txt tone="muted" style={{ textAlign: "center" }}>No entries match these filters.</Txt>
              </Card>
            ) : null}
            {filteredEntries.map((entry: any) => (
              <Card key={entry._id} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  <Badge label={entry.source.replaceAll("_", " ")} color={sourceColor(entry.source) as any} />
                  {entry.tags?.slice(0, 2).map((tag: string) => <Badge key={tag} label={tag} color="gray" />)}
                </View>
                <Txt variant="section">{entry.title}</Txt>
                <Txt tone="muted">
                  {shortDate(entry.startAt)} - {timeRange(entry.startAt, entry.endAt)}
                  {entry.location ? ` - ${entry.location}` : ""}
                </Txt>
                {entry.description ? <Txt tone="muted">{entry.description}</Txt> : null}
                {entry.source === "PERSONAL" ? (
                  <ListRow
                    title="Delete personal entry"
                    subtitle="Remove this from your calendar."
                    onPress={() => {
                      void warning();
                      Alert.alert("Delete entry?", "This removes the personal calendar entry.", [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () =>
                            removeEntry({ entryId: entry._id }).catch((error) =>
                              showToast({ title: "Could not delete", body: error instanceof Error ? error.message : "Try again." }),
                            ),
                        },
                      ]);
                    }}
                  />
                ) : null}
              </Card>
            ))}
          </Section>
        )}
      </DataBoundary>

      <Sheet open={showCreate} onClose={() => setShowCreate(false)} title="Personal Entry">
        <TextField value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Title" />
        <TextField value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} placeholder="YYYY-MM-DD" />
        <TextField value={form.time} onChangeText={(time) => setForm((current) => ({ ...current, time }))} placeholder="HH:mm optional" />
        <TextField value={form.location} onChangeText={(location) => setForm((current) => ({ ...current, location }))} placeholder="Location optional" />
        <TextField value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Description optional" multiline />
        <Button title="Save entry" onPress={submit} />
      </Sheet>
    </View>
  );
}

function parseLocalDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  const safeTime = time.trim() || "08:00";
  if (!/^\d{2}:\d{2}$/.test(safeTime)) return null;
  const value = new Date(`${date.trim()}T${safeTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value.getTime();
}
