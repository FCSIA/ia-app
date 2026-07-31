import { router } from "expo-router";
import { Bell, ChevronRight, Palette } from "lucide-react-native";
import { View } from "react-native";
import { AppDetailHeader, FormScreen } from "@/components/screen";
import { Avatar } from "@/components/ui/avatar";
import {
  CompactList,
  CompactListItem,
  CompactListSectionHeader,
} from "@/components/ui/compact-list";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function SettingsScreen() {
  const user = useCurrentUser();
  const { color } = useTheme();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const navigationChevron = (
    <ChevronRight
      accessibilityElementsHidden
      color={color("mutedForeground")}
      size={17}
      strokeWidth={2}
    />
  );

  return (
    <FormScreen navigation={<AppDetailHeader title="Settings" />}>
      <CompactList density="default">
        <CompactListItem
          leading={<Avatar uri={user?.avatarUrl} name={fullName} size={40} />}
          title={fullName || "Innovation Academy"}
          detail={
            user?.uniqueId
              ? `${user.uniqueId} · Profile and account`
              : "Profile and account"
          }
          trailing={navigationChevron}
          onPress={() => router.push("/profile" as never)}
        />
      </CompactList>

      <View>
        <CompactListSectionHeader title="Preferences" />
        <CompactList separation="leading">
          <CompactListItem
            icon={Palette}
            title="Appearance"
            detail="Theme and colors"
            trailing={navigationChevron}
            onPress={() => router.push("/settings/theme" as never)}
          />
          <CompactListItem
            icon={Bell}
            title="Notifications"
            detail="Push alerts and topics"
            trailing={navigationChevron}
            onPress={() => router.push("/settings/notifications" as never)}
          />
        </CompactList>
      </View>
    </FormScreen>
  );
}
