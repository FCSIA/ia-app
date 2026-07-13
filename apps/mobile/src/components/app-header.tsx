import type { ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { Avatar, IconButton, PressableScale, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const EMPTY_ARGS = {};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function AppHeader({ title, subtitle, action }: AppHeaderProps) {
  const auth = useConvexAuth();
  const user = useCurrentUser();
  const { color } = useTheme();
  const unread = useQuery(api.notifications.inbox.unreadCount, auth.isAuthenticated ? EMPTY_ARGS : "skip");
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Innovation Academy";
  const unreadLabel = unread?.count && unread.count > 99 ? "99+" : String(unread?.count ?? "");

  return (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <PressableScale
        accessibilityLabel={`Open profile for ${name}`}
        onPress={() => router.push("/profile" as never)}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Avatar uri={user?.avatarUrl} name={name} size={40} />
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {action}
        <View>
          <IconButton
            icon={Bell}
            label={unread?.count ? `Open inbox, ${unread.count} unread` : "Open inbox"}
            onPress={() => router.push("/notifications" as never)}
          />
          {unread?.count ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -spacing.xs,
                right: -spacing.xs,
                minWidth: 18,
                height: 18,
                borderRadius: radii.pill,
                borderWidth: 2,
                borderColor: color("background"),
                backgroundColor: color("primary"),
                paddingHorizontal: spacing.xs,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt
                variant="caption"
                style={{ color: color("primaryForeground"), fontSize: 10, lineHeight: 12, fontWeight: "800" }}
              >
                {unreadLabel}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
