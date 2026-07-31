import { ScrollView, View, type ScrollViewProps } from "react-native";
import { router, useSegments } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { IconButton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

type ScreenProps = ScrollViewProps & {
  title?: string;
  subtitle?: string;
  navigation?: ReactNode;
  header?: ReactNode;
};

export function Screen({
  title,
  subtitle,
  navigation,
  header,
  children,
  contentContainerStyle,
  ...props
}: ScreenProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isTabRoute =
    (segments as string[]).includes("(tabs)") ||
    (segments as string[]).some((s) =>
      ["dashboard", "calendar", "clubs", "announcements", "discover"].includes(
        s,
      ),
    );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color("background") }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={[
          {
            width: "100%",
            maxWidth: 760,
            alignSelf: "center",
            paddingHorizontal: spacing.lg,
            paddingTop: Math.max(
              spacing.lg,
              insets.top ? spacing.md : spacing.lg,
            ),
            paddingBottom: isTabRoute
              ? 112
              : Math.max(spacing.xl, insets.bottom + spacing.lg),
            gap: spacing.md,
          },
          contentContainerStyle,
        ]}
        {...props}
      >
        {navigation === undefined ? <AppBackHeader /> : navigation}
        {header}
        {title ? (
          <View style={{ gap: spacing.xs }}>
            <Txt variant="display">{title}</Txt>
            {subtitle ? (
              <Txt variant="body" tone="muted">
                {subtitle}
              </Txt>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AppDetailHeader({
  title,
  subtitle,
  leading,
  action,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View
      style={{
        width: "100%",
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <AppBackHeader forceVisible />
      {leading}
      <View style={{ minWidth: 0, flex: 1, gap: 1 }}>
        <Txt
          variant="section"
          numberOfLines={1}
          style={{ fontSize: 17, lineHeight: 21 }}
        >
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function AppBackHeader({
  forceVisible = false,
}: {
  forceVisible?: boolean;
}) {
  const segments = useSegments();
  const { color } = useTheme();
  const isTabRoute = segments[0] === "(tabs)";
  const isAuthRoute = segments[0] === "(auth)";
  const shouldShow =
    forceVisible || (!!segments.length && !isTabRoute && !isAuthRoute);

  if (!shouldShow) return null;

  return (
    <IconButton
      icon={ArrowLeft}
      label="Go back"
      onPress={() => router.back()}
    />
  );
}
