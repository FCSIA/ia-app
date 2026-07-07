import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

function pathwayLabel(value?: string | null) {
  if (!value) return "No pathway";
  if (value === "INFORMATION_TECHNOLOGY") return "Information Technology";
  if (value === "HEALTH_SCIENCE") return "Health Science";
  if (value === "ENGINEERING") return "Engineering";
  return value;
}

export default function CourseDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const course = useQuery(api.courses.catalog.get, slug ? { slug } : "skip");
  const { color } = useTheme();

  return (
    <Screen>
      <DataBoundary data={course} emptyTitle="Course unavailable">
        {(item: any) => (
          <View style={{ gap: 14 }}>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={item.department} color="blue" />
                <Badge label={pathwayLabel(item.pathway)} color={item.pathway ? "emerald" : "gray"} />
                {item.catalogSource !== "COURSE_CATALOG" ? <Badge label="AP / merged" color="amber" /> : null}
              </View>
              <Text style={{ color: color("foreground"), fontSize: 28, fontWeight: "900" }}>{item.title}</Text>
              <Text style={{ color: color("mutedForeground"), lineHeight: 21 }}>
                {item.gradeText ?? `Grades ${item.minGrade ?? "?"}-${item.maxGrade ?? "?"}`}
                {item.courseNumbers?.length ? ` - ${item.courseNumbers.join(", ")}` : ""}
              </Text>
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Catalog Notes</Text>
              <Text style={{ color: color("mutedForeground"), lineHeight: 21 }}>
                {item.summary ?? item.prerequisitesText ?? "No additional catalog notes are available for this class."}
              </Text>
              {item.prerequisitesText && item.summary ? (
                <Text style={{ color: color("mutedForeground"), lineHeight: 21 }}>Prerequisites: {item.prerequisitesText}</Text>
              ) : null}
              {item.majorTopics ? <Text style={{ color: color("mutedForeground"), lineHeight: 21 }}>Major topics: {item.majorTopics}</Text> : null}
              {item.essentialSkills ? <Text style={{ color: color("mutedForeground"), lineHeight: 21 }}>Skills: {item.essentialSkills}</Text> : null}
            </Card>

            <Card style={{ gap: 8 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Details</Text>
              <Detail label="Term" value={item.term} />
              <Detail label="Grades" value={item.gradeText} />
              <Detail label="Source" value={item.catalogSource} />
            </Card>
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  const { color } = useTheme();
  if (value == null || value === "") return null;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ color: color("mutedForeground"), width: 84, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: color("foreground"), flex: 1 }}>{String(value).replaceAll("_", " ")}</Text>
    </View>
  );
}
