import { useState } from "react";
import { View } from "react-native";
import { Bell, BookOpen, ChevronRight } from "lucide-react-native";
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
    <Screen title="Design System" subtitle="Native primitive parity gallery.">
      <Section title="Type">
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="display">Display</Txt>
          <Txt variant="title">Title</Txt>
          <Txt variant="section">Section</Txt>
          <Txt>Body text for school-centered workflows.</Txt>
          <Txt variant="caption" tone="muted">Caption text</Txt>
        </Card>
      </Section>

      <Section title="Actions">
        <Card style={{ gap: spacing.sm }}>
          <Button title="Primary" onPress={() => showToast({ title: "Primary action", tone: "success" })} />
          <Button title="Secondary" variant="secondary" />
          <Button title="Tertiary" variant="tertiary" />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <IconButton icon={Bell} label="Bell" onPress={() => showToast({ title: "Inbox opened" })} />
            <IconButton icon={ChevronRight} label="Next" variant="primary" onPress={() => {}} />
          </View>
        </Card>
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
          onToggle={(value) => setChips((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])}
        />
        <ListRow title="Push notifications" subtitle="Animated switch row" trailing={<Switch value={enabled} onValueChange={setEnabled} />} />
      </Section>

      <Section title="Content">
        <ListRow icon={BookOpen} title="Course catalog" subtitle="Search pathways and courses" />
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <Badge label="School Wide" color="blue" />
            <Badge label="Club" color="amber" />
            <Badge label="Saved" color="emerald" variant="dot" />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Avatar name="Innovation Academy" />
            <View style={{ flex: 1 }}>
              <Txt variant="label">Innovation Academy</Txt>
              <Txt variant="caption" tone="muted">Avatar, card, badge, and stat primitives.</Txt>
            </View>
          </View>
          <Stat value="24" label="credits" />
        </Card>
      </Section>

      <Section title="Inputs and States">
        <TextField placeholder="Search IA" />
        <TextField placeholder="Message" multiline />
        <SkeletonList count={2} />
        <Empty title="Nothing here yet" body="Empty states keep the layout calm." />
      </Section>
    </Screen>
  );
}
