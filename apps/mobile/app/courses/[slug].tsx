import {
  COURSE_SOURCE_LABELS,
  courseGradeLabel,
  pathwayLabel,
  sentenceCaseEnum,
} from "~/apps/shared/labels";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@/lib/convex-react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Section, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function CourseDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const course = useQuery(api.courses.catalog.get, slug ? { slug } : "skip");

  return (
    <Screen contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
      <DataBoundary data={course} emptyTitle="Course unavailable">
        {(item: any) => {
          const pathway = item.pathway ? pathwayLabel(item.pathway) ?? null : null;

          return (
            <View style={{ gap: spacing.xl }}>
              <View style={{ gap: spacing.sm }}>
                <Txt variant="overline" tone="primary">
                  {[item.department, pathway].filter(Boolean).join(" · ")}
                </Txt>
                <Txt variant="display">{item.title}</Txt>
                <Txt tone="muted">
                  {[courseGradeLabel(item), item.courseNumbers?.join(", ")].filter(Boolean).join(" · ")}
                </Txt>
              </View>

              {item.summary ? <CourseSection title="Overview" body={item.summary} /> : null}
              {item.prerequisitesText ? <CourseSection title="Prerequisites" body={item.prerequisitesText} /> : null}
              {item.majorTopics ? <CourseSection title="Topics" body={item.majorTopics} /> : null}
              {item.essentialSkills ? <CourseSection title="Skills you’ll build" body={item.essentialSkills} /> : null}
              {item.studentWorkload ? <CourseSection title="Student workload" body={item.studentWorkload} /> : null}

              <Section title="Course details">
                <View>
                  <DetailRow label="Department" value={item.department} />
                  <DetailRow label="Pathway" value={pathway} />
                  <DetailRow label="Term" value={item.term ? sentenceCaseEnum(item.term) : null} />
                  <DetailRow label="Grades" value={courseGradeLabel(item)} />
                  <DetailRow label="Course number" value={item.courseNumbers?.join(", ")} />
                  <DetailRow label="Source" value={item.catalogSource ? COURSE_SOURCE_LABELS[item.catalogSource as keyof typeof COURSE_SOURCE_LABELS] ?? null : null} last />
                </View>
              </Section>
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}

function CourseSection({ title, body }: { title: string; body: string }) {
  return (
    <Section title={title}>
      <Txt tone="muted">{body}</Txt>
    </Section>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value?: string | number | null;
  last?: boolean;
}) {
  const { color } = useTheme();
  if (value == null || value === "") return null;

  return (
    <View
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color("border"),
      }}
    >
      <Txt variant="label" tone="muted" style={{ width: 112 }}>
        {label}
      </Txt>
      <Txt style={{ flex: 1 }}>{String(value)}</Txt>
    </View>
  );
}

