import { useState } from "react";
import { View } from "react-native";
import { useMutation } from "@/lib/convex-react";
import { Button, Sheet, TextField, Txt, useToast, SegmentedControl } from "@/components/ui";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

type CreateFlexFridaySheetProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateFlexFridaySheet({ open, onClose }: CreateFlexFridaySheetProps) {
  const createFriday = useMutation(api.flexFriday.fridays.create);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [type, setType] = useState<"ALL_STUDENT" | "GRADE_SPECIFIC" | "PATHWAY_SPECIFIC" | "TEACHER_PD">("ALL_STUDENT");
  const [gradeLevel, setGradeLevel] = useState<number>(9);
  const [pathway, setPathway] = useState<"INFORMATION_TECHNOLOGY" | "HEALTH_SCIENCE" | "ENGINEERING">("INFORMATION_TECHNOLOGY");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const canSubmit = !!date && !creating;

  function reset() {
    setDate(undefined);
    setType("ALL_STUDENT");
    setGradeLevel(9);
    setPathway("INFORMATION_TECHNOLOGY");
    setNotes("");
  }

  function close() {
    if (creating) return;
    reset();
    onClose();
  }

  async function submit() {
    if (!canSubmit) return;
    setCreating(true);
    
    // Normalize date to start of day
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    try {
      await createFriday({
        date: normalizedDate.getTime(),
        type,
        gradeLevel: type === "GRADE_SPECIFIC" ? gradeLevel : undefined,
        pathway: type === "PATHWAY_SPECIFIC" ? pathway : undefined,
        notes: notes.trim() || undefined,
      });
      reset();
      onClose();
      showToast({ title: "Flex Friday created", tone: "success" });
    } catch (error) {
      showToast({
        title: "Couldn't create Flex Friday",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Schedule Flex Friday">
      <View style={{ gap: spacing.md }}>
        <DateTimePicker
          value={date}
          onChange={setDate}
          mode="date"
          placeholder="Select date"
        />

        <View style={{ gap: spacing.sm }}>
          <Txt variant="overline" tone="muted">Schedule type</Txt>
          <SegmentedControl
            value={type}
            onChange={(val) => setType(val as "ALL_STUDENT" | "GRADE_SPECIFIC" | "PATHWAY_SPECIFIC" | "TEACHER_PD")}
            segments={[
              { label: "All Student", value: "ALL_STUDENT" },
              { label: "Grade", value: "GRADE_SPECIFIC" },
              { label: "Pathway", value: "PATHWAY_SPECIFIC" },
            ]}
          />
        </View>

        {type === "GRADE_SPECIFIC" ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="overline" tone="muted">Grade Level</Txt>
            <SegmentedControl
              value={gradeLevel.toString()}
              onChange={(val) => setGradeLevel(parseInt(val, 10))}
              segments={[
                { label: "9", value: "9" },
                { label: "10", value: "10" },
                { label: "11", value: "11" },
                { label: "12", value: "12" },
              ]}
            />
          </View>
        ) : null}

        {type === "PATHWAY_SPECIFIC" ? (
          <View style={{ gap: spacing.sm }}>
            <Txt variant="overline" tone="muted">Pathway</Txt>
            <SegmentedControl
              value={pathway}
              onChange={setPathway}
              segments={[
                { label: "IT", value: "INFORMATION_TECHNOLOGY" },
                { label: "Health", value: "HEALTH_SCIENCE" },
                { label: "Engineering", value: "ENGINEERING" },
              ]}
            />
          </View>
        ) : null}

        <TextField
          accessibilityLabel="Notes"
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
        />

        <Button
          title="Create"
          loading={creating}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}
