import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { shortDate, timeRange } from "@/lib/format";
import { useTheme } from "@/lib/theme";
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

export default function CalendarScreen() {
  const { color } = useTheme();
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeSources, setActiveSources] = useState<string[]>([...sources]);
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
      Alert.alert("Calendar", "Add a title and date. Use YYYY-MM-DD and optional HH:mm time.");
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
    } catch (error) {
      Alert.alert("Could not add entry", error instanceof Error ? error.message : "Try again.");
    }
  }

  function toggleSource(source: string) {
    setActiveSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source],
    );
  }

  return (
    <Screen title="Calendar" subtitle="School, club, Flex Friday, district, and personal entries.">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Button title="Prev" size="sm" variant="secondary" onPress={() => setOffset((value) => value - 1)} />
          <Text style={{ color: color("foreground"), flex: 1, textAlign: "center", fontSize: 18, fontWeight: "900" }}>
            {range.start.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </Text>
          <Button title="Next" size="sm" variant="secondary" onPress={() => setOffset((value) => value + 1)} />
        </View>
        <TextField value={query} onChangeText={setQuery} placeholder="Search entries" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sources.map((source) => (
            <Button
              key={source}
              title={source.replaceAll("_", " ")}
              size="sm"
              variant={activeSources.includes(source) ? "primary" : "secondary"}
              onPress={() => toggleSource(source)}
            />
          ))}
        </View>
        <Button title={showCreate ? "Cancel personal entry" : "Add personal entry"} variant="tertiary" onPress={() => setShowCreate((value) => !value)} />
      </Card>

      {showCreate ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Personal Entry</Text>
          <TextField value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Title" />
          <TextField value={form.date} onChangeText={(date) => setForm((current) => ({ ...current, date }))} placeholder="YYYY-MM-DD" />
          <TextField value={form.time} onChangeText={(time) => setForm((current) => ({ ...current, time }))} placeholder="HH:mm optional" />
          <TextField value={form.location} onChangeText={(location) => setForm((current) => ({ ...current, location }))} placeholder="Location optional" />
          <TextField value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Description optional" multiline />
          <Button title="Save entry" onPress={submit} />
        </Card>
      ) : null}

      <DataBoundary data={entries} emptyTitle="No calendar entries">
        {() => (
          <View style={{ gap: 12 }}>
            {filteredEntries.length === 0 ? (
              <Card>
                <Text style={{ color: color("mutedForeground"), textAlign: "center", fontWeight: "800" }}>No entries match these filters.</Text>
              </Card>
            ) : null}
            {filteredEntries.map((entry: any) => (
              <Card key={entry._id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Badge label={entry.source.replaceAll("_", " ")} color={sourceColor(entry.source) as any} />
                  {entry.tags?.slice(0, 2).map((tag: string) => <Badge key={tag} label={tag} color="gray" />)}
                </View>
                <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>{entry.title}</Text>
                <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
                  {shortDate(entry.startAt)} - {timeRange(entry.startAt, entry.endAt)}
                  {entry.location ? ` - ${entry.location}` : ""}
                </Text>
                {entry.description ? <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>{entry.description}</Text> : null}
                {entry.source === "PERSONAL" ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      removeEntry({ entryId: entry._id }).catch((error) =>
                        Alert.alert("Could not delete", error instanceof Error ? error.message : "Try again."),
                      )
                    }
                  >
                    <Text style={{ color: color("destructive"), fontWeight: "900" }}>Delete personal entry</Text>
                  </Pressable>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}

function parseLocalDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  const safeTime = time.trim() || "08:00";
  if (!/^\d{2}:\d{2}$/.test(safeTime)) return null;
  const value = new Date(`${date.trim()}T${safeTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value.getTime();
}
