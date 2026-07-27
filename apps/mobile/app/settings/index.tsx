import { router } from "expo-router";
import { Bell, Palette } from "lucide-react-native";
import { Screen } from "@/components/screen";
import { Avatar, ListRow, Section } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";

export default function SettingsScreen() {
  const user = useCurrentUser();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <Screen title="Settings">
      <ListRow
        leading={<Avatar uri={user?.avatarUrl} name={fullName} size={44} />}
        title={fullName || "Innovation Academy"}
        subtitle={user?.uniqueId ? `${user.uniqueId} · Profile and account` : "Profile and account"}
        onPress={() => router.push("/profile" as never)}
      />

      <Section title="Preferences">
        <ListRow icon={Palette} title="Appearance" subtitle="Theme and colors" onPress={() => router.push("/settings/theme" as never)} />
        <ListRow icon={Bell} title="Notifications" subtitle="Push alerts and topics" onPress={() => router.push("/settings/notifications" as never)} />
      </Section>
    </Screen>
  );
}
