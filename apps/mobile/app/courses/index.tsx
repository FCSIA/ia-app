import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { BookOpen, Search } from "lucide-react-native";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

const pathways = [
  { label: "All", value: "ALL" },
  { label: "Engineering", value: "ENGINEERING" },
  { label: "IT", value: "INFORMATION_TECHNOLOGY" },
  { label: "Health", value: "HEALTH_SCIENCE" },
] as const;

const grades = ["ALL", "9", "10", "11", "12"] as const;

function pathwayLabel(value?: string | null) {
  if (!value) return "All pathways";
  if (value === "INFORMATION_TECHNOLOGY") return "Information Technology";
  if (value === "HEALTH_SCIENCE") return "Health Science";
  if (value === "ENGINEERING") return "Engineering";
  return value;
}

export default function CoursesScreen() {
  const user = useCurrentUser();
  const { color } = useTheme();
  const [query, setQuery] = useState("");
  const [pathway, setPathway] = useState<(typeof pathways)[number]["value"]>("ALL");
  const [grade, setGrade] = useState<(typeof grades)[number]>("ALL");
  const [department, setDepartment] = useState("ALL");

  const allCourses = useQuery(api.courses.catalog.list, { limit: 500 });
  const courses = useQuery(api.courses.catalog.list, {
    q: query.trim() || undefined,
    pathway: pathway === "ALL" ? undefined : pathway,
    gradeLevel: grade === "ALL" ? undefined : Number(grade),
    department: department === "ALL" ? undefined : department,
    limit: 200,
  });

  const departments = useMemo(
    () => ["ALL", ...Array.from(new Set((allCourses ?? []).map((course: any) => course.department))).sort()],
    [allCourses],
  );

  return (
    <Screen title="Courses" subtitle="Browse IA classes, pathways, departments, and grade eligibility.">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Search size={18} color={color("mutedForeground")} />
          <TextField
            style={{ flex: 1 }}
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, course number, or department"
            returnKeyType="search"
          />
        </View>
        {user?.gradeLevel ? (
          <Button title={`Show my grade (${user.gradeLevel})`} variant="secondary" onPress={() => setGrade(String(user.gradeLevel) as any)} />
        ) : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontWeight: "900", fontSize: 18 }}>Filters</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {pathways.map((item) => (
            <Button
              key={item.value}
              title={item.label}
              size="sm"
              variant={pathway === item.value ? "primary" : "secondary"}
              onPress={() => setPathway(item.value)}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {grades.map((item) => (
            <Button
              key={item}
              title={item === "ALL" ? "All grades" : `Grade ${item}`}
              size="sm"
              variant={grade === item ? "primary" : "secondary"}
              onPress={() => setGrade(item)}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {departments.slice(0, 12).map((item) => (
            <Button
              key={item}
              title={item === "ALL" ? "All departments" : item}
              size="sm"
              variant={department === item ? "primary" : "secondary"}
              onPress={() => setDepartment(item)}
            />
          ))}
        </View>
      </Card>

      <DataBoundary data={courses} emptyTitle="No courses matched">
        {(items) => (
          <View style={{ gap: 12 }}>
            <Text style={{ color: color("mutedForeground"), fontWeight: "700" }}>
              {items.length} loaded course{items.length === 1 ? "" : "s"}
            </Text>
            {items.map((course: any) => (
              <Pressable key={course.id} onPress={() => router.push(`/courses/${course.slug}` as any)}>
                <Card style={{ gap: 9 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={course.department} color="blue" />
                    {course.pathway ? <Badge label={pathwayLabel(course.pathway)} color="emerald" /> : null}
                    {course.catalogSource !== "COURSE_CATALOG" ? <Badge label="AP / merged" color="amber" /> : null}
                  </View>
                  <Text style={{ color: color("foreground"), fontWeight: "900", fontSize: 18 }}>{course.title}</Text>
                  <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
                    {course.gradeText ?? `Grades ${course.minGrade ?? "?"}-${course.maxGrade ?? "?"}`}
                    {course.courseNumbers?.length ? ` - ${course.courseNumbers.join(", ")}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <BookOpen size={16} color={color("mutedForeground")} />
                    <Text style={{ color: color("mutedForeground"), fontWeight: "700" }}>Open class details</Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
