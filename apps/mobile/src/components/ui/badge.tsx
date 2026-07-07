import { Text, View } from "react-native";
import { badgeColors, type BadgeColor } from "@ia/design-tokens";
import { useTheme } from "@/lib/theme";

type BadgeProps = {
  label: string;
  color?: BadgeColor;
  variant?: "solid" | "dot";
};

export function Badge({ label, color = "gray", variant = "solid" }: BadgeProps) {
  const { color: themeColor } = useTheme();
  const badgeColor = badgeColors[color];
  const backgroundColor = color === "gray" ? themeColor("muted") : `${badgeColor}22`;
  const borderColor = color === "gray" ? themeColor("border") : `${badgeColor}66`;
  const textColor = color === "gray" ? themeColor("foreground") : badgeColor;

  return (
    <View
      style={{
        minHeight: 24,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor,
        backgroundColor,
        paddingHorizontal: 10
      }}
    >
      {variant === "dot" ? (
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: badgeColor }} />
      ) : null}
      <Text style={{ color: textColor, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
