import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-react";
import { Button, ChipGroup, Sheet, TextField, Txt, useToast } from "@/components/ui";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useCurrentUser } from "@/lib/auth";
import { api } from "~/apps/convex/src/_generated/api";

type CreateEventSheetProps = {
  open: boolean;
  onClose: () => void;
  defaultClubId?: string;
};

export function CreateEventSheet({ open, onClose, defaultClubId }: CreateEventSheetProps) {
  const user = useCurrentUser();
  const myClubs = useQuery(api.clubs.management.getMyClubs, {});
  const createEvent = useMutation(api.events.events.create);
  const { showToast } = useToast();

  const canCreateGeneral = !!user?.roles?.some((role) =>
    ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"].includes(role),
  );

  const availableClubs = useMemo(
    () =>
      [
        ...((myClubs?.memberOf ?? []).filter(
          (club: any) => club.role === "LEADER" || club.role === "SPONSOR",
        )),
        ...(myClubs?.sponsoring ?? []),
      ].filter(
        (club: any, index: number, list: any[]) =>
          list.findIndex((item) => item._id === club._id) === index,
      ),
    [myClubs],
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    clubId: defaultClubId ?? (!canCreateGeneral ? (availableClubs[0]?._id ?? "") : ""),
  });
  const [startAt, setStartAt] = useState<Date | undefined>(undefined);
  const [endAt, setEndAt] = useState<Date | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const selectedClubId = form.clubId;

  function reset() {
    setForm({
      title: "",
      description: "",
      location: "",
      clubId: defaultClubId ?? (!canCreateGeneral ? (availableClubs[0]?._id ?? "") : ""),
    });
    setStartAt(undefined);
    setEndAt(undefined);
  }

  function handleClose() {
    if (creating) return;
    reset();
    onClose();
  }

  async function submitCreate() {
    if (!form.title.trim() || !startAt) {
      showToast({ title: "Add a title and valid start time" });
      return;
    }
    if (!canCreateGeneral && !selectedClubId) {
      showToast({ title: "Choose a club" });
      return;
    }
    setCreating(true);
    try {
      await createEvent({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        startAt: startAt.getTime(),
        endAt: endAt ? endAt.getTime() : undefined,
        clubId: selectedClubId ? (selectedClubId as any) : undefined,
      });
      showToast({ title: "Event submitted", tone: "success" });
      handleClose();
    } catch (error) {
      showToast({
        title: "Event not submitted",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="New event">
      <TextField
        value={form.title}
        onChangeText={(title) => setForm((current) => ({ ...current, title }))}
        placeholder="Title"
        maxLength={160}
      />
      <TextField
        value={form.description}
        onChangeText={(description) => setForm((current) => ({ ...current, description }))}
        placeholder="Description (optional)"
        maxLength={2000}
        multiline
      />
      <TextField
        value={form.location}
        onChangeText={(location) => setForm((current) => ({ ...current, location }))}
        placeholder="Location (optional)"
      />
      <DateTimePicker
        value={startAt}
        onChange={setStartAt}
        mode="datetime"
        placeholder="Starts"
      />
      <DateTimePicker
        value={endAt}
        onChange={setEndAt}
        mode="datetime"
        minimumDate={startAt}
        placeholder="Ends (optional)"
      />

      <Txt variant="overline" tone="muted">
        Organizer
      </Txt>
      {canCreateGeneral ? (
        <ChipGroup
          values={["GENERAL"] as const}
          selected={!form.clubId ? ["GENERAL"] : []}
          labels={{ GENERAL: "School" }}
          onToggle={() => setForm((current) => ({ ...current, clubId: "" }))}
        />
      ) : null}
      {availableClubs.length > 0 && (
        <ChipGroup
          values={availableClubs.map((club: any) => club._id)}
          selected={selectedClubId ? [selectedClubId] : []}
          labels={Object.fromEntries(
            availableClubs.map((club: any) => [club._id, club.name]),
          )}
          onToggle={(clubId) => setForm((current) => ({ ...current, clubId }))}
        />
      )}
      <Button
        title="Submit"
        onPress={() => void submitCreate()}
        loading={creating}
        disabled={creating || !form.title.trim() || !startAt}
      />
    </Sheet>
  );
}
