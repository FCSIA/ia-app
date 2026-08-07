import type { LoadingFact as LoadingFactValue } from "@ia/fun-facts";
import { Image, View } from "react-native";
import { Lightbulb } from "lucide-react-native";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

export function LoadingFact({ fact }: { fact: LoadingFactValue }) {
  const { color } = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        width: "100%",
        maxWidth: 360,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: color("border"),
        backgroundColor: color("card"),
        padding: spacing.md,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 18,
          backgroundColor: color("secondary"),
        }}
      >
        {fact.visual === "phoenix" ? (
          <Image
            source={require("../../../assets/logo.png")}
            accessibilityIgnoresInvertColors
            style={{ width: 28, height: 28, borderRadius: 14 }}
            resizeMode="contain"
          />
        ) : (
          <Lightbulb size={17} color={color("primary")} strokeWidth={1.8} />
        )}
      </View>
      <Txt tone="muted" style={{ flex: 1, lineHeight: 20 }}>
        {fact.text}
      </Txt>
    </View>
  );
}
