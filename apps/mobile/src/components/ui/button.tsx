import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";
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
  const disabledStyle = disabled || loading;
  const backgroundColor =
    variant === "primary"
      ? disabledStyle ? color("muted") : color("primary")
      : variant === "secondary"
        ? color("secondary")
        : "transparent";
  const borderColor = disabledStyle && variant === "primary" ? color("border") : variant === "tertiary" ? color("border") : "transparent";
  const textColor =
    variant === "primary"
      ? disabledStyle ? color("mutedForeground") : color("primaryForeground")
      : color("foreground");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={(state) => [
        { opacity: disabledStyle ? 1 : state.pressed ? 0.76 : 1 },
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      <View
        style={{
          minHeight: height,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: size === "sm" ? 12 : 16,
          borderWidth: variant === "tertiary" || (disabledStyle && variant === "primary") ? 1 : 0,
          borderColor,
          backgroundColor,
        }}
      >
        {loading ? <ActivityIndicator color={textColor} /> : null}
        {!loading && Icon ? <Icon size={18} color={textColor} strokeWidth={1.8} /> : null}
        <Text style={{ color: textColor, fontWeight: "700" }} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}
