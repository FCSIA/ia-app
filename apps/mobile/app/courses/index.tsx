import { useMemo, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Search } from "lucide-react-native";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { FilterChip, PressableScale, TextField, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const pathways = [
  { label: "All", value: "ALL" },
  { label: "Engineering", value: "ENGINEERING" },
  { label: "IT", value: "INFORMATION_TECHNOLOGY" },
  { label: "Health", value: "HEALTH_SCIENCE" },
] as const;

const grades = ["ALL", "9", "10", "11", "12"] as const;

function pathwayLabel(value?: string | null) {
  if (value === "INFORMATION_TECHNOLOGY") return "Information Technology";
  if (value === "HEALTH_SCIENCE") return "Health Science";
  if (value === "ENGINEERING") return "Engineering";
  return null;
}

function gradeLabel(course: any) {
  if (course.gradeText) return course.gradeText;
  if (course.minGrade && course.minGrade === course.maxGrade) return `Grade ${course.minGrade}`;
  return `Grades ${course.minGrade ?? "?"}–${course.maxGrade ?? "?"}`;
}

function sourceLabel(value: string) {
  if (value === "AP_CATALOG") return "AP catalog";
  if (value === "MERGED") return "IA + AP catalogs";
  return null;
}

export default function CoursesScreen() {
  const user = useCurrentUser();
  const { color } = useTheme();
  const [query, setQuery] = useState("");
  const [pathway, setPathway] = useState<(typeof pathways)[number]["value"]>("ALL");
  const [grade, setGrade] = useState<(typeof grades)[number]>("ALL");
  const [department, setDepartment] = useState("ALL");

  const catalogMetadata = useQuery(api.courses.catalog.listDepartments, {});
  const courses = useQuery(api.courses.catalog.list, {
    q: query.trim() || undefined,
    pathway: pathway === "ALL" ? undefined : pathway,
    gradeLevel: grade === "ALL" ? undefined : Number(grade),
    department: department === "ALL" ? undefined : department,
    limit: 200,
  });

  const departments = useMemo(
    () => ["ALL", ...(catalogMetadata?.departments ?? [])],
    [catalogMetadata],
  );

  return (
    <Screen
      title="Courses"
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center" }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          backgroundColor: color("secondary"),
        }}
      >
        <Search size={19} color={color("mutedForeground")} />
        <TextField
          accessibilityLabel="Search courses"
          style={{ flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 }}
          value={query}
          onChangeText={setQuery}
          placeholder="Title, number, or department"
          returnKeyType="search"
        />
      </View>

      <FilterRail label="Pathway">
        {pathways.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            selected={pathway === item.value}
            onPress={() => setPathway(item.value)}
          />
        ))}
      </FilterRail>

      <FilterRail label="Grade">
        {grades.map((item) => (
          <FilterChip
            key={item}
            label={item === "ALL" ? "All" : item === String(user?.gradeLevel) ? `${item} · mine` : item}
            selected={grade === item}
            onPress={() => setGrade(item)}
          />
        ))}
      </FilterRail>

      <FilterRail label="Department">
        {departments.map((item) => (
          <FilterChip
            key={item}
            label={item === "ALL" ? "All" : item}
            selected={department === item}
            onPress={() => setDepartment(item)}
          />
        ))}
      </FilterRail>

      <DataBoundary data={courses} emptyTitle="No courses match these filters">
        {(items) => (
          <View
            style={{
              overflow: "hidden",
              borderRadius: radii.lg,
              backgroundColor: color("card"),
            }}
          >
            {items.map((course: any, index) => (
              <CourseRow key={course.id} course={course} showDivider={index < items.length - 1} />
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}

function FilterRail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Txt variant="overline" tone="muted">
        {label}
      </Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function CourseRow({ course, showDivider }: { course: any; showDivider: boolean }) {
  const { color } = useTheme();
  const pathway = pathwayLabel(course.pathway);
  const source = sourceLabel(course.catalogSource);
  const secondary = [pathway, source].filter(Boolean).join(" · ");
  const metadata = [gradeLabel(course), course.courseNumbers?.join(", ")].filter(Boolean).join(" · ");

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open ${course.title}`}
      onPress={() => router.push(`/courses/${course.slug}` as never)}
      style={{ minHeight: 92, paddingHorizontal: spacing.md }}
    >
      <View
        style={{
          flex: 1,
          minHeight: 92,
          paddingVertical: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: color("border"),
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Txt variant="overline" tone="primary" numberOfLines={1}>
            {course.department}
          </Txt>
          <Txt variant="section" numberOfLines={2}>
            {course.title}
          </Txt>
          {secondary ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {secondary}
            </Txt>
          ) : null}
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {metadata}
          </Txt>
        </View>
        <ChevronRight size={20} color={color("mutedForeground")} />
      </View>
    </PressableScale>
  );
}
