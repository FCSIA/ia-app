import { ScrollView, type ScrollViewProps } from "react-native";
import { router, useSegments } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { IconButton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

type ScreenProps = ScrollViewProps & {
  title?: string;
  subtitle?: string;
  header?: ReactNode;
};

export function Screen({ title, subtitle, header, children, contentContainerStyle, ...props }: ScreenProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          {
            paddingHorizontal: spacing.lg,
            paddingTop: Math.max(spacing.lg, insets.top ? spacing.md : spacing.lg),
            paddingBottom: 96,
            gap: spacing.md
          },
          contentContainerStyle
        ]}
        {...props}
      >
        <AppBackHeader />
        {header}
        {title ? (
          <>
            <Txt variant="display">{title}</Txt>
            {subtitle ? (
              <Txt variant="body" tone="muted">
                {subtitle}
              </Txt>
            ) : null}
          </>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AppBackHeader({ forceVisible = false }: { forceVisible?: boolean }) {
  const segments = useSegments();
  const { color } = useTheme();
  const isTabRoute = segments[0] === "(tabs)";
  const isAuthRoute = segments[0] === "(auth)";
  const shouldShow = forceVisible || (!!segments.length && !isTabRoute && !isAuthRoute);

  if (!shouldShow) return null;

  return <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />;
}
