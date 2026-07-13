import { useState } from "react";
import { View } from "react-native";
import { Bell, BookOpen, ChevronRight, Inbox } from "lucide-react-native";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChipGroup,
  Empty,
  IconButton,
  ListRow,
  Section,
  SegmentedControl,
  SkeletonList,
  Stat,
  Switch,
  TextField,
  Txt,
  useToast,
} from "@/components/ui";
import { Screen } from "@/components/screen";
import { spacing } from "@/lib/tokens";

type DemoSegment = "one" | "two" | "three";

export default function DesignSystemScreen() {
  const [segment, setSegment] = useState<DemoSegment>("one");
  const [chips, setChips] = useState<string[]>(["School"]);
  const [enabled, setEnabled] = useState(true);
  const { showToast } = useToast();

  return (
    <Screen
      title="Design system"
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
    >
      <Section title="Type">
        <View style={{ gap: spacing.xs }}>
          <Txt variant="display">Display</Txt>
          <Txt variant="title">Title</Txt>
          <Txt variant="section">Section</Txt>
          <Txt>Body text for school workflows.</Txt>
          <Txt variant="label">Label</Txt>
          <Txt variant="caption" tone="muted">Caption</Txt>
        </View>
      </Section>

      <Section title="Actions">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <Button
            title="Primary"
            onPress={() => showToast({ title: "Primary action", tone: "success" })}
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
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
          <IconButton icon={Bell} label="Show inbox notice" onPress={() => showToast({ title: "Inbox opened" })} />
          <IconButton
            icon={ChevronRight}
            label="Show next notice"
            variant="primary"
            onPress={() => showToast({ title: "Next action" })}
          />
          <Button title="Disabled" variant="secondary" disabled style={{ minWidth: 120 }} />
          <Button title="Saving" variant="tertiary" loading style={{ minWidth: 120 }} />
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
              current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
            )
          }
        />
        <ListRow
          title="Push notifications"
          subtitle={enabled ? "Enabled" : "Disabled"}
          trailing={<Switch label="Push notifications" value={enabled} onValueChange={setEnabled} />}
        />
      </Section>

      <Section title="Content">
        <ListRow
          icon={BookOpen}
          title="Course catalog"
          subtitle="Search pathways and courses"
          onPress={() => showToast({ title: "Course catalog row" })}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar name="Innovation Academy" />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: "700" }}>Innovation Academy</Txt>
            <Txt variant="caption" tone="muted">Avatar and supporting text</Txt>
          </View>
          <Badge label="School wide" color="blue" />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <Badge label="Club" color="amber" />
          <Badge label="Saved" color="emerald" variant="dot" />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <View style={{ flexGrow: 1, minWidth: 140 }}>
            <Stat value="24" label="Credits" />
          </View>
          <Card variant="flat" style={{ flexGrow: 1, minWidth: 200, gap: spacing.xs }}>
            <Txt variant="label">Surface</Txt>
            <Txt variant="caption" tone="muted">A single content boundary.</Txt>
          </Card>
        </View>
      </Section>

      <Section title="Inputs">
        <View style={{ gap: spacing.xs }}>
          <Txt variant="label">Search</Txt>
          <TextField placeholder="Search IA" accessibilityLabel="Search" />
        </View>
        <View style={{ gap: spacing.xs }}>
          <Txt variant="label">Message</Txt>
          <TextField placeholder="Write a message" accessibilityLabel="Message" multiline />
        </View>
      </Section>

      <Section title="Loading">
        <SkeletonList count={2} />
      </Section>

      <Section title="Empty">
        <Empty title="No announcements" body="New school updates will appear here." icon={Inbox} />
      </Section>
    </Screen>
  );
}
