import { ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

type ScreenProps = ScrollViewProps & {
  title?: string;
  subtitle?: string;
};

export function Screen({ title, subtitle, children, contentContainerStyle, ...props }: ScreenProps) {
  const { color } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          {
            padding: 18,
            paddingBottom: 32,
            gap: 16
          },
          contentContainerStyle
        ]}
        {...props}
      >
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
