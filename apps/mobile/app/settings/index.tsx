import { View } from "react-native";
import { router } from "expo-router";
import { Bell, KeyRound, Palette, UserRound } from "lucide-react-native";
import { Screen } from "@/components/screen";
import { Avatar, Card, ListRow, Section, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { spacing } from "@/lib/tokens";

export default function SettingsScreen() {
  const user = useCurrentUser();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <Screen title="Settings" subtitle="Profile, appearance, notifications, and account controls.">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar uri={user?.avatarUrl} name={fullName} size={48} />
        <View style={{ flex: 1 }}>
          <Txt variant="section">{fullName || "Innovation Academy"}</Txt>
          <Txt variant="caption" tone="muted">{user?.uniqueId}</Txt>
        </View>
      </Card>

      <Section title="Account">
        <ListRow icon={UserRound} title="Profile" subtitle="Avatar, password, sign out, and account support" onPress={() => router.push("/profile" as never)} />
        <ListRow icon={KeyRound} title="Password" subtitle="Change your account password from Profile" onPress={() => router.push("/profile" as never)} />
      </Section>

      <Section title="Preferences">
        <ListRow icon={Palette} title="Appearance" subtitle="Theme and color preferences" onPress={() => router.push("/settings/theme" as never)} />
        <ListRow icon={Bell} title="Notifications" subtitle="Push devices and categories" onPress={() => router.push("/settings/notifications" as never)} />
      </Section>
    </Screen>
  );
}
