import { ActivityIndicator, Text, View, type PressableProps } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

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
  const height = size === "sm" ? 44 : size === "lg" ? 50 : 46;
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
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={typeof style === "function" ? undefined : style}
      {...props}
    >
      <View
        style={{
          minHeight: height,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: size === "sm" ? spacing.md : spacing.lg,
          borderWidth: variant === "tertiary" || (disabledStyle && variant === "primary") ? 1 : 0,
          borderColor,
          backgroundColor,
          opacity: disabledStyle ? 0.68 : 1,
        }}
      >
        {loading ? <ActivityIndicator color={textColor} /> : null}
        {!loading && Icon ? <Icon size={18} color={textColor} strokeWidth={1.8} /> : null}
        <Text style={{ color: textColor, fontWeight: "700" }} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}
