import { View } from "react-native";
import { router } from "expo-router";
import { Bell, Settings } from "lucide-react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { Avatar, Badge, IconButton, PressableScale, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const EMPTY_ARGS = {};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
};

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const auth = useConvexAuth();
  const user = useCurrentUser();
  const unread = useQuery(api.notifications.inbox.unreadCount, auth.isAuthenticated ? EMPTY_ARGS : "skip");
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Innovation Academy";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <PressableScale accessibilityLabel="Open profile" onPress={() => router.push("/profile" as never)}>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Avatar uri={user?.avatarUrl} name={name} size={42} />
          <Txt variant="caption" tone="muted">Profile</Txt>
        </View>
      </PressableScale>
      <View style={{ flex: 1 }}>
        <Txt variant="title" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <IconButton icon={Settings} label="Open settings" onPress={() => router.push("/settings" as never)} />
        <View>
          <IconButton icon={Bell} label="Open inbox" onPress={() => router.push("/notifications" as never)} />
          {unread?.count ? (
            <View style={{ position: "absolute", top: -4, right: -4 }}>
              <Badge label={String(unread.count)} color="orange" />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
