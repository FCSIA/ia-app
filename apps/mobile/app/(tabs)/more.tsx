import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const links = [
  { title: "Events", href: "/events", body: "Agenda, registrations, and calendar entries." },
  { title: "Flex Friday", href: "/flex-friday", body: "Browse sessions, registrations, and pass details." },
  { title: "Profile", href: "/profile", body: "Account, avatar, logout, and account deletion request path." },
  { title: "Theme", href: "/settings/theme", body: "Light, dark, high contrast, bubblegum, and custom palette." },
  { title: "Design system", href: "/design-system", body: "Native primitive gallery for parity review." }
];

export default function MoreScreen() {
  const user = useCurrentUser();
  const { color } = useTheme();
  return (
    <Screen title="More" subtitle={[user?.firstName, user?.lastName].filter(Boolean).join(" ")}>
      <View style={{ gap: 10 }}>
        {links.map((link) => (
          <Pressable key={link.href} onPress={() => router.push(link.href as any)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: color("foreground"), fontSize: 17, fontWeight: "900" }}>{link.title}</Text>
                <Text style={{ color: color("mutedForeground"), lineHeight: 19 }}>{link.body}</Text>
              </View>
              <ChevronRight color={color("mutedForeground")} size={20} />
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
