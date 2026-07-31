import type { LucideIcon } from "lucide-react-native";
import type { GestureResponderEvent } from "react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: (event?: GestureResponderEvent) => void;
  size?: "xs" | "sm" | "md";
  variant?: "default" | "primary" | "ghost" | "destructive";
  disabled?: boolean;
};

export function IconButton({
  icon: Icon,
  label,
  onPress,
  size = "md",
  variant = "default",
  disabled,
}: IconButtonProps) {
  const { color } = useTheme();
  const dimension = size === "xs" ? 36 : size === "sm" ? 44 : 46;
  const backgroundColor =
    variant === "primary"
      ? color("primary")
      : variant === "ghost"
        ? "transparent"
        : color("secondary");
  const iconColor =
    variant === "primary"
      ? color("primaryForeground")
      : variant === "destructive"
        ? color("destructive")
        : color("foreground");

  return (
    <PressableScale
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={size === "xs" ? 4 : undefined}
      onPress={onPress}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
        opacity: disabled ? 0.5 : 1,
        padding: size === "xs" ? spacing.xs : spacing.sm,
      }}
    >
      <Icon
        size={size === "xs" ? 17 : size === "sm" ? 18 : 20}
        color={iconColor}
        strokeWidth={2}
      />
    </PressableScale>
  );
}
