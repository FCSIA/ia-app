import { useState } from "react";
import { View } from "react-native";
import {
  Bell,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Hash,
  Inbox,
  LockKeyhole,
  Megaphone,
  Trash2,
} from "lucide-react-native";
import { FeedScreen } from "@/components/screen";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CompactList,
  CompactListItem,
  CompactListSectionHeader,
} from "@/components/ui/compact-list";
import { Empty } from "@/components/ui/empty";
import { CompactSearchField, Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Inline, Stack } from "@/components/ui/layout";
import { ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/section";
import { Separator } from "@/components/ui/separator";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SkeletonList } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { densityMetrics, spacing } from "@/lib/tokens";

type DemoSegment = "one" | "two" | "three";

export default function DesignSystemScreen() {
  const [segment, setSegment] = useState<DemoSegment>("one");
  const [chips, setChips] = useState<string[]>(["School"]);
  const [enabled, setEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [disclosureOpen, setDisclosureOpen] = useState(true);
  const { showToast } = useToast();
  const { color } = useTheme();

  return (
    <FeedScreen
      title="Design system"
      contentContainerStyle={{
        gap: spacing.lg,
      }}
    >
      <Section title="Type">
        <View style={{ gap: spacing.xs }}>
          <Txt variant="display">Display</Txt>
          <Txt variant="title">Title</Txt>
          <Txt variant="section">Section</Txt>
          <Txt>Body text for school workflows.</Txt>
          <Txt variant="label">Label</Txt>
          <Txt variant="caption" tone="muted">
            Caption
          </Txt>
        </View>
      </Section>

      <Section title="Actions">
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          <Button
            title="Primary"
            onPress={() =>
              showToast({ title: "Primary action", tone: "success" })
            }
            style={{ flexGrow: 1, minWidth: 160 }}
          />
          <Button
            title="Secondary"
            variant="secondary"
            onPress={() => showToast({ title: "Secondary action" })}
            style={{ flexGrow: 1, minWidth: 140 }}
          />
          <Button
            title="Tertiary"
            variant="tertiary"
            onPress={() => showToast({ title: "Tertiary action" })}
            style={{ flexGrow: 1, minWidth: 130 }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: spacing.sm,
          }}
        >
          <IconButton
            icon={Bell}
            label="Show inbox notice"
            onPress={() => showToast({ title: "Inbox opened" })}
          />
          <IconButton
            icon={ChevronRight}
            label="Show next notice"
            variant="primary"
            onPress={() => showToast({ title: "Next action" })}
          />
          <Button
            title="Disabled"
            variant="secondary"
            disabled
            style={{ minWidth: 120 }}
          />
          <Button
            title="Saving"
            variant="tertiary"
            loading
            style={{ minWidth: 120 }}
          />
        </View>
      </Section>

      <Section title="Selection">
        <SegmentedControl
          value={segment}
          onChange={setSegment}
          segments={[
            { label: "One", value: "one" },
            { label: "Two", value: "two" },
            { label: "Three", value: "three" },
          ]}
        />
        <ChipGroup
          values={["School", "Club", "Flex"] as const}
          selected={chips}
          onToggle={(value) =>
            setChips((current) =>
              current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value],
            )
          }
        />
        <ListRow
          title="Push notifications"
          subtitle={enabled ? "Enabled" : "Disabled"}
          trailing={
            <Switch
              label="Push notifications"
              value={enabled}
              onValueChange={setEnabled}
            />
          }
        />
      </Section>

      <Section title="Density">
        <Stack gap="sm">
          {(["compact", "default", "comfortable"] as const).map((density) => (
            <Stack key={density} gap="xs">
              <Inline
                gap="sm"
                distribution="between"
                style={{ paddingHorizontal: spacing.sm }}
              >
                <Txt variant="label" style={{ textTransform: "capitalize" }}>
                  {density}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {densityMetrics[density].rowMinHeight}px row ·{" "}
                  {densityMetrics[density].touchTarget}px touch
                </Txt>
              </Inline>
              <CompactList density={density}>
                <CompactListItem
                  icon={Hash}
                  title="student-life"
                  detail={
                    density === "comfortable"
                      ? "Room for supporting context"
                      : undefined
                  }
                  onPress={() => showToast({ title: `${density} row` })}
                />
              </CompactList>
            </Stack>
          ))}
        </Stack>
      </Section>

      <Section title="Compact list states">
        <Stack gap="none">
          <CompactListSectionHeader
            title="Text channels"
            count={5}
            action={
              <Txt variant="caption" tone="muted">
                Hold to preview press
              </Txt>
            }
          />
          <CompactList separation="full">
            <CompactListItem
              icon={Hash}
              title="general"
              onPress={() => showToast({ title: "Default row" })}
            />
            <CompactListItem
              icon={Hash}
              title="course-planning"
              state="selected"
              trailing={<StateLabel label="Selected" />}
              onPress={() => showToast({ title: "Selected row" })}
            />
            <CompactListItem
              icon={Megaphone}
              title="announcements"
              state="unread"
              trailing={<StateLabel label="3 new" />}
              onPress={() => showToast({ title: "Unread row" })}
            />
            <CompactListItem
              icon={LockKeyhole}
              title="sponsor-notes"
              state="disabled"
              trailing={<StateLabel label="Restricted" />}
              onPress={() => showToast({ title: "Disabled rows do not open" })}
            />
            <CompactListItem
              icon={Trash2}
              title="Remove saved item"
              state="destructive"
              onPress={() =>
                showToast({ title: "Destructive action", tone: "warning" })
              }
            />
          </CompactList>
        </Stack>
      </Section>

      <Section title="Content">
        <ListRow
          icon={BookOpen}
          title="Course catalog"
          subtitle="Search pathways and courses"
          onPress={() => showToast({ title: "Course catalog row" })}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Avatar name="Innovation Academy" />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: "700" }}>Innovation Academy</Txt>
            <Txt variant="caption" tone="muted">
              Avatar and supporting text
            </Txt>
          </View>
          <Badge label="School wide" color="blue" />
        </View>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          <Badge label="Club" color="amber" />
          <Badge label="Saved" color="emerald" variant="dot" />
        </View>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          <View style={{ flexGrow: 1, minWidth: 140 }}>
            <Stat value="24" label="Credits" />
          </View>
          <Card
            variant="flat"
            style={{ flexGrow: 1, minWidth: 200, gap: spacing.xs }}
          >
            <Txt variant="label">Surface</Txt>
            <Txt variant="caption" tone="muted">
              A single content boundary.
            </Txt>
          </Card>
        </View>
      </Section>

      <Section title="Inputs">
        <CompactSearchField
          accessibilityLabel="Search design system examples"
          placeholder="Search examples"
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery("")}
        />
        <Field.Root>
          <Field.Label required>School email</Field.Label>
          <TextField
            accessibilityLabel="School email"
            autoCapitalize="none"
            density="compact"
            keyboardType="email-address"
            placeholder="student@fultonschools.org"
          />
          <Field.Description>
            Used for account and safety notifications.
          </Field.Description>
        </Field.Root>
        <Field.Root>
          <Field.Label>Invite code</Field.Label>
          <TextField
            accessibilityLabel="Invite code with error"
            density="compact"
            state="invalid"
            value="IA-OLD"
            editable={false}
          />
          <Field.Error>This invite code has expired.</Field.Error>
        </Field.Root>
        <View style={{ gap: spacing.xs }}>
          <Txt variant="label">Search</Txt>
          <TextField placeholder="Search IA" accessibilityLabel="Search" />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Txt variant="label">Message</Txt>
          <TextField
            placeholder="Write a message"
            accessibilityLabel="Message"
            multiline
          />
        </View>
      </Section>

      <Section title="Disclosure">
        <Collapsible open={disclosureOpen} onOpenChange={setDisclosureOpen}>
          <CollapsibleTrigger
            accessibilityLabel="Toggle accessibility notes"
            style={{ paddingHorizontal: spacing.sm, gap: spacing.sm }}
          >
            <Txt variant="label" style={{ flex: 1, fontWeight: "700" }}>
              Accessibility notes
            </Txt>
            {disclosureOpen ? (
              <ChevronUp size={16} color={color("mutedForeground")} />
            ) : (
              <ChevronDown size={16} color={color("mutedForeground")} />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator />
            <Txt variant="caption" tone="muted" style={{ padding: spacing.sm }}>
              The trigger exposes expanded state and the content keeps its
              region semantics.
            </Txt>
          </CollapsibleContent>
        </Collapsible>
      </Section>

      <Section title="Loading">
        <SkeletonList count={2} />
      </Section>

      <Section title="Empty">
        <Empty
          title="No announcements"
          body="New school updates will appear here."
          icon={Inbox}
        />
      </Section>
    </FeedScreen>
  );
}

function StateLabel({ label }: { label: string }) {
  return (
    <Txt variant="caption" tone="muted" numberOfLines={1}>
      {label}
    </Txt>
  );
}
