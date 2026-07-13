import { View } from "react-native";
import { router } from "expo-router";
import { BookOpen, ChevronRight, QrCode, Sparkles, type LucideIcon } from "lucide-react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { PressableScale, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

const destinations = [
  {
    title: "Courses",
    detail: "Catalog, pathways, and grade options",
    href: "/courses",
    icon: BookOpen,
  },
  {
    title: "Flex Friday",
    detail: "Sessions, registration, and your pass",
    href: "/flex-friday",
    icon: QrCode,
  },
  {
    title: "Wrapped",
    detail: "Your year at Innovation Academy",
    href: "/wrapped",
    icon: Sparkles,
  },
] as const;

export default function DiscoverScreen() {
  const { color } = useTheme();

  return (
    <Screen
      header={<AppHeader title="Discover" />}
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center" }}
    >
      <View
        style={{
          overflow: "hidden",
          borderRadius: radii.lg,
          backgroundColor: color("secondary"),
        }}
      >
        {destinations.map((destination, index) => (
          <DestinationRow
            key={destination.href}
            {...destination}
            showDivider={index < destinations.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}

function DestinationRow({
  title,
  detail,
  href,
  icon: Icon,
  showDivider,
}: {
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  showDivider: boolean;
}) {
  const { color } = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      onPress={() => router.push(href as never)}
      style={{ minHeight: 76, paddingHorizontal: spacing.md }}
    >
      <View
        style={{
          flex: 1,
          minHeight: 76,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: color("border"),
        }}
      >
        <Icon size={21} color={color("primary")} strokeWidth={1.9} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="section" numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {detail}
          </Txt>
        </View>
        <ChevronRight size={20} color={color("mutedForeground")} />
      </View>
    </PressableScale>
  );
}
