import { Pressable, ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { router, useSegments } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

type ScreenProps = ScrollViewProps & {
  title?: string;
  subtitle?: string;
};

export function Screen({ title, subtitle, children, contentContainerStyle, ...props }: ScreenProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          {
            padding: 18,
            paddingTop: Math.max(22, insets.top ? 10 : 22),
            paddingBottom: 32,
            gap: 16
          },
          contentContainerStyle
        ]}
        {...props}
      >
        <AppBackHeader />
        {title ? (
          <View style={{ gap: 4 }}>
            <Text style={{ color: color("foreground"), fontSize: 28, fontWeight: "900" }}>{title}</Text>
            {subtitle ? (
              <Text style={{ color: color("mutedForeground"), fontSize: 14, lineHeight: 20 }}>{subtitle}</Text>
            ) : null}
          </View>
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => router.back()}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        width: 92,
        opacity: pressed ? 0.72 : 1
      })}
    >
      <View
        style={{
          minHeight: 40,
          width: 92,
          borderRadius: 999,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: 12,
          backgroundColor: color("secondary")
        }}
      >
        <ArrowLeft size={18} color={color("foreground")} strokeWidth={2} />
        <Text style={{ color: color("foreground"), fontWeight: "800" }}>Back</Text>
      </View>
    </Pressable>
  );
}
