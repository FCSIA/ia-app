import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

type ButtonProps = PressableProps & {
  title: string;
  variant?: "primary" | "secondary" | "tertiary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { color } = useTheme();
  const height = size === "sm" ? 34 : size === "lg" ? 46 : 40;
  const backgroundColor =
    variant === "primary"
      ? color("foreground")
      : variant === "secondary"
        ? color("accent")
        : "transparent";
  const borderColor = variant === "tertiary" ? color("border") : "transparent";
  const textColor = variant === "primary" ? color("background") : color("foreground");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: height,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: size === "sm" ? 12 : 16,
          borderWidth: variant === "tertiary" ? 1 : 0,
          borderColor,
          backgroundColor,
          opacity: disabled ? 0.45 : pressed ? 0.76 : 1
        },
        typeof style === "function" ? style({ pressed }) : style
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={textColor} /> : null}
      {!loading && Icon ? <Icon size={18} color={textColor} strokeWidth={1.8} /> : null}
      <Text style={{ color: textColor, fontWeight: "700" }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}
