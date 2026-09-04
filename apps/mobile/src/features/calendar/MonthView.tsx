import { useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus, Trash2, UserPlus } from "lucide-react-native";
import { useMutation, useQuery } from "@/lib/convex-react";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { DataBoundary } from "@/components/data-boundary";
import {
  Button,
  ChipGroup,
  IconButton,
  ListRow,
  Sheet,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { getAppPersona, useLiveCurrentUser } from "@/lib/auth";
import { CALENDAR_SOURCES as sources, monthRange } from "@/lib/calendar-window";
import { timeRange } from "@/lib/format";
import { warning } from "@/lib/haptics";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const sourceFilterLabels: Record<(typeof sources)[number], string> = {
  DISTRICT: "District",
  SCHOOL: "School",
  CLUB: "Clubs",
  FLEX_FRIDAY: "Flex",
  PERSONAL: "Personal",
  EXTERNAL: "Connected",
};
const sourceDisplayLabels = { ...sourceFilterLabels, CLUB: "Club" };

export function MonthView() {
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeSources, setActiveSources] = useState<(typeof sources)[number][]>([
    ...sources,
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [connection, setConnection] = useState({ name: "Canvas", url: "" });
  const [form, setForm] = useState({
    title: "",
    location: "",
    description: "",
  });
  const [startAt, setStartAt] = useState<Date | undefined>(undefined);
  const [shareEntry, setShareEntry] = useState<any | null>(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Id<"users">[]>([]);
  const [pendingInviteId, setPendingInviteId] = useState<Id<"calendarInvites"> | null>(null);
  const [sharing, setSharing] = useState(false);
  const user = useLiveCurrentUser();
  const canShareWithFriends = getAppPersona(user) === "student";
  const range = monthRange(offset);
  const entries = useQuery(api.events.calendar.list, {
    startDate: range.start.getTime(),
    endDate: range.end.getTime(),
    sources: activeSources,
  });
  const createEntry = useMutation(api.events.calendar.create);
  const removeEntry = useMutation(api.events.calendar.remove);
  const subscriptions = useQuery(api.events.externalCalendars.listMine) ?? [];
  const createConnection = useMutation(api.events.externalCalendars.createIcs);
  const removeConnection = useMutation(api.events.externalCalendars.remove);
  const inviteFriends = useMutation(api.events.calendar.inviteFriends);
  const respondToInvite = useMutation(api.events.calendar.respondToInvite);
  const friends = useQuery(
    api.events.calendar.listEligibleFriends,
    shareEntry && canShareWithFriends ? {} : "skip",
  );
  const pendingInvites = useQuery(api.events.calendar.listPendingInvites, {}) ?? [];
  const { showToast } = useToast();
  const { color } = useTheme();

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

  async function submitConnection() {
    if (!connection.name.trim() || !connection.url.trim()) {
      showToast({ title: "Add a name and HTTPS ICS URL" });
      return;
    }
    try {
      await createConnection({ displayName: connection.name, feedUrl: connection.url });
      setConnection({ name: "Canvas", url: "" });
      setShowConnections(false);
      showToast({ title: "Calendar connected", tone: "success" });
    } catch (error) {
      showToast({ title: "Calendar not connected", body: error instanceof Error ? error.message : "Try again." });
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

  function openShare(entry: any) {
    setSelectedFriendIds([]);
    setShareEntry(entry);
  }

  function toggleFriend(friendId: Id<"users">) {
    setSelectedFriendIds((current) => {
      if (current.includes(friendId)) {
        return current.filter((id) => id !== friendId);
      }
      if (current.length >= 20) {
        showToast({ title: "You can invite up to 20 friends" });
        return current;
      }
      return [...current, friendId];
    });
  }

  async function sendInvites() {
    if (!shareEntry || selectedFriendIds.length === 0) return;
    setSharing(true);
    try {
      const result = await inviteFriends({
        entryId: shareEntry._id,
        friendIds: selectedFriendIds,
      });
      setShareEntry(null);
      setSelectedFriendIds([]);
      showToast({
        title: result.invited === 1 ? "Invite sent" : `${result.invited} invites sent`,
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "Invites not sent",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSharing(false);
    }
  }

  async function respondToCalendarInvite(
    inviteId: Id<"calendarInvites">,
    accept: boolean,
  ) {
    setPendingInviteId(inviteId);
    try {
      await respondToInvite({ inviteId, accept });
      showToast({
        title: accept ? "Added to your calendar" : "Invite declined",
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: "Invite not updated",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setPendingInviteId(null);
    }
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
          <Button
            title="Connect"
            size="sm"
            variant="tertiary"
            onPress={() => setShowConnections(true)}
            style={{ alignSelf: "flex-end" }}
          />
        </View>
      </View>

      {pendingInvites.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" tone="muted">
            Calendar invitations
          </Txt>
          {pendingInvites.map((invite) => (
            <View
              key={invite._id}
              style={{
                gap: spacing.md,
                borderRadius: radii.xl,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: color("border"),
                backgroundColor: color("card"),
                padding: spacing.md,
              }}
            >
              <View style={{ gap: spacing.xs }}>
                <Txt variant="label" numberOfLines={2}>
                  {invite.entry.title}
                </Txt>
                <Txt variant="caption" tone="muted" numberOfLines={2}>
                  {timeRange(invite.entry.startAt, invite.entry.endAt).replace(" - ", "–")} · {invite.sender.firstName} {invite.sender.lastName}
                </Txt>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  title="Accept"
                  size="sm"
                  loading={pendingInviteId === invite._id}
                  disabled={pendingInviteId !== null}
                  onPress={() => void respondToCalendarInvite(invite._id, true)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Decline"
                  size="sm"
                  variant="tertiary"
                  disabled={pendingInviteId !== null}
                  onPress={() => void respondToCalendarInvite(invite._id, false)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

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
                  onShare={canShareWithFriends ? openShare : undefined}
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
          maxLength={160}
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
          maxLength={2000}
          multiline
        />
        <Button title="Add" onPress={submit} />
      </Sheet>

      <Sheet open={showConnections} onClose={() => setShowConnections(false)} title="Calendar connections">
        <Txt tone="muted">Connect a private Canvas or other HTTPS ICS feed. Example: fultonschools.instructure.com.</Txt>
        {subscriptions.map((subscription) => (
          <View key={subscription._id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Txt variant="label">{subscription.displayName}</Txt>
              <Txt variant="caption" tone={subscription.status === "ERROR" ? "destructive" : "muted"} numberOfLines={2}>
                {subscription.status === "ERROR" ? subscription.lastError ?? "Sync failed" : "Connected"}
              </Txt>
            </View>
            <Button title="Remove" size="sm" variant="tertiary" onPress={() => void removeConnection({ subscriptionId: subscription._id })} />
          </View>
        ))}
        <TextField value={connection.name} onChangeText={(name) => setConnection((current) => ({ ...current, name }))} placeholder="Name" />
        <TextField value={connection.url} onChangeText={(url) => setConnection((current) => ({ ...current, url }))} placeholder="HTTPS ICS feed URL" autoCapitalize="none" keyboardType="url" />
        <Button title="Connect ICS feed" onPress={() => void submitConnection()} />
      </Sheet>

      <Sheet
        open={shareEntry !== null}
        onClose={() => {
          if (sharing) return;
          setShareEntry(null);
          setSelectedFriendIds([]);
        }}
        title="Share reminder"
        scrollable
      >
        <Txt tone="muted">
          Invite accepted friends to add {shareEntry?.title ?? "this reminder"} to their calendar.
        </Txt>
        {friends === undefined ? (
          <Txt tone="muted">Loading friends…</Txt>
        ) : friends.length === 0 ? (
          <Txt tone="muted">Add accepted friends from Schedule to share reminders.</Txt>
        ) : (
          friends.map((friend) => {
            const selected = selectedFriendIds.includes(friend._id);
            return (
              <ListRow
                key={friend._id}
                title={`${friend.firstName} ${friend.lastName}`}
                trailing={
                  <Button
                    title={selected ? "Selected" : "Select"}
                    size="sm"
                    variant={selected ? "tertiary" : "primary"}
                    onPress={() => toggleFriend(friend._id)}
                    disabled={sharing}
                  />
                }
              />
            );
          })
        )}
        <Button
          title={selectedFriendIds.length === 1 ? "Send invite" : `Send ${selectedFriendIds.length} invites`}
          onPress={() => void sendInvites()}
          loading={sharing}
          disabled={sharing || selectedFriendIds.length === 0}
        />
      </Sheet>
    </View>
  );
}

function CalendarDayGroup({
  date,
  entries,
  onDelete,
  onShare,
}: {
  date: Date;
  entries: any[];
  onDelete: (entry: any) => void;
  onShare?: (entry: any) => void;
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
            onShare={onShare && !entry.inviteId ? () => onShare(entry) : undefined}
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
  onShare,
}: {
  entry: any;
  last: boolean;
  onDelete: () => void;
  onShare?: () => void;
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
        {entry.sharedBy ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            Shared by {entry.sharedBy.firstName} {entry.sharedBy.lastName}
          </Txt>
        ) : null}
      </View>
      {entry.source === "PERSONAL" ? (
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {onShare ? (
            <IconButton
              icon={UserPlus}
              label={`Share ${entry.title}`}
              size="sm"
              variant="ghost"
              onPress={onShare}
            />
          ) : null}
          {!entry.inviteId ? (
            <IconButton
              icon={Trash2}
              label={`Delete ${entry.title}`}
              size="sm"
              variant="ghost"
              onPress={onDelete}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
