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
  const backgroundColor = color === "gray" ? themeColor("muted") : hexToRgba(badgeColor, 0.13);
  const borderColor = color === "gray" ? themeColor("border") : hexToRgba(badgeColor, 0.4);
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

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
