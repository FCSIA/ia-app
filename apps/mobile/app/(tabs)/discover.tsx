import { View } from "react-native";
import { router } from "expo-router";
import { BookOpen, QrCode, Sparkles } from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { Button, Card, Section, Txt } from "@/components/ui";
import { spacing } from "@/lib/tokens";

const cards = [
  {
    title: "Courses",
    body: "Search the catalog, pathway options, grade filters, and course details.",
    href: "/courses",
    icon: BookOpen,
    action: "Browse courses",
  },
  {
    title: "Flex Friday",
    body: "Find sessions, register, check assignments, and open your Flex pass.",
    href: "/flex-friday",
    icon: QrCode,
    action: "Open Flex",
  },
  {
    title: "Wrapped",
    body: "Your seasonal school-year activity summary when it opens.",
    href: "/wrapped",
    icon: Sparkles,
    action: "View Wrapped",
  },
] as const;

export default function DiscoverScreen() {
  return (
    <Screen header={<AppHeader title="Discover" subtitle="Courses, Flex Friday, and seasonal highlights." />}>
      <Section title="Explore">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.href} onPress={() => router.push(card.href as never)} style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Icon size={24} />
                <View style={{ flex: 1 }}>
                  <Txt variant="section">{card.title}</Txt>
                  <Txt tone="muted">{card.body}</Txt>
                </View>
              </View>
              <Button title={card.action} variant="secondary" onPress={() => router.push(card.href as never)} />
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}
