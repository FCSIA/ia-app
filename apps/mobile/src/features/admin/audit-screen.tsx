import { useDeferredValue, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@/lib/convex-react";
import type { FunctionReturnType } from "convex/server";
import { Search } from "lucide-react-native";
import { Screen } from "@/components/screen";
import {
  Badge,
  Button,
  Empty,
  PressableScale,
  Section,
  SegmentedControl,
  Sheet,
  SkeletonList,
  TextField,
  Txt,
} from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

type AuditEvent = FunctionReturnType<typeof api.audit.events.list>[number];
type ActorScope = "ALL" | "USER" | "SYSTEM";

const sourceFilters = [
  { label: "All", value: "ALL" },
  { label: "People", value: "USER" },
  { label: "System", value: "SYSTEM" },
] as const;

export function AuditScreen() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [actorScope, setActorScope] = useState<ActorScope>("ALL");
  const [selectedId, setSelectedId] = useState<Id<"auditEvents"> | null>(null);
  const events = useQuery(api.audit.events.list, {
    limit: 200,
    query: deferredSearch || undefined,
    actorScope: actorScope === "ALL" ? undefined : actorScope,
  });
  const detail = useQuery(
    api.audit.events.get,
    selectedId ? { auditEventId: selectedId } : "skip",
  );

  return (
    <Screen title="Audit log" keyboardShouldPersistTaps="handled">
      <TextField
        accessibilityLabel="Search audit records"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Action, actor, or record ID"
        returnKeyType="search"
        value={search}
        onChangeText={setSearch}
      />
      <SegmentedControl segments={sourceFilters} value={actorScope} onChange={setActorScope} />
      <Txt variant="caption" tone="muted">
        Search and filters apply to the 200 most recent records.
      </Txt>

      <Section
        title="Recent activity"
        action={search ? <Button title="Clear" variant="ghost" size="sm" onPress={() => setSearch("")} /> : undefined}
      >
        {events === undefined ? (
          <SkeletonList count={6} />
        ) : events.length === 0 ? (
          <Empty
            icon={Search}
            title="No matching records"
            body={deferredSearch || actorScope !== "ALL" ? "Try a broader search or source." : "No activity has been recorded."}
          />
        ) : (
          <AuditList events={events} onOpen={setSelectedId} />
        )}
      </Section>

      <Sheet open={!!selectedId} onClose={() => setSelectedId(null)} title="Audit record" snapPoints={["68%", "90%"]}>
        {detail === undefined ? (
          <SkeletonList count={4} />
        ) : detail === null ? (
          <Empty title="Record unavailable" body="It may have been removed." />
        ) : (
          <AuditDetail event={detail} />
        )}
      </Sheet>
    </Screen>
  );
}

function AuditList({
  events,
  onOpen,
}: {
  events: AuditEvent[];
  onOpen: (id: Id<"auditEvents">) => void;
}) {
  const { color } = useTheme();

  return (
    <View
      style={{
        overflow: "hidden",
        borderRadius: radii.lg,
        backgroundColor: color("secondary"),
      }}
    >
      {events.map((event, index) => (
        <PressableScale
          key={event.id}
          accessibilityRole="button"
          accessibilityLabel={`Inspect ${humanize(event.action)} audit record`}
          onPress={() => onOpen(event.id)}
          style={{
            minHeight: 76,
            justifyContent: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderBottomWidth: index === events.length - 1 ? 0 : 1,
            borderBottomColor: color("border"),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Txt variant="label" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
              {humanize(event.action)}
            </Txt>
            <Txt variant="caption" tone="muted">{formatRelativeDate(event.createdAt)}</Txt>
          </View>
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {actorName(event)} · {event.entityType}{event.entityId ? ` · ${shortId(event.entityId)}` : ""}
          </Txt>
        </PressableScale>
      ))}
    </View>
  );
}

function AuditDetail({ event }: { event: NonNullable<FunctionReturnType<typeof api.audit.events.get>> }) {
  const metadata = metadataRows(event.meta);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Badge label={event.entityType} variant="dot" />
        <Txt variant="section">{humanize(event.action)}</Txt>
        <Txt variant="caption" tone="muted">{event.action}</Txt>
      </View>

      <View style={{ gap: spacing.md }}>
        <DetailRow label="Recorded" value={formatDateTime(event.createdAt)} />
        <DetailRow
          label="Actor"
          value={event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "System"}
        />
        <DetailRow label="Entity" value={event.entityType} detail={event.entityId ?? undefined} />
      </View>

      {metadata.length ? (
        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" tone="muted">Metadata</Txt>
          {metadata.slice(0, 8).map((row) => (
            <DetailRow key={row.label} label={humanize(row.label)} value={row.value} />
          ))}
          {metadata.length > 8 ? (
            <Txt variant="caption" tone="muted">{metadata.length - 8} more metadata fields</Txt>
          ) : null}
        </View>
      ) : (
        <Txt variant="caption" tone="muted">No metadata was recorded.</Txt>
      )}
    </View>
  );
}

function DetailRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Txt variant="caption" tone="muted">{label}</Txt>
      <Txt variant="label" selectable>{value}</Txt>
      {detail ? <Txt variant="caption" tone="muted" selectable numberOfLines={2}>{detail}</Txt> : null}
    </View>
  );
}

function metadataRows(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  return Object.entries(meta as Record<string, unknown>).map(([label, value]) => ({
    label,
    value: formatMetadataValue(value),
  }));
}

function formatMetadataValue(value: unknown) {
  if (value === null) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "Unavailable";
  }
}

function actorName(event: AuditEvent) {
  return event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : "System";
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
