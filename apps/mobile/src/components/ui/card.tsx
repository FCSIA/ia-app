import { View, type ViewProps } from "react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useTheme } from "@/lib/theme";
import { elevation, radii, spacing } from "@/lib/tokens";

type CardProps = ViewProps & {
  variant?: "default" | "flat";
  onPress?: () => void;
};

export function Card({ style, variant = "default", onPress, ...props }: CardProps) {
  const { color } = useTheme();
  const content = (
    <View
      style={[
        {
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: color("border"),
          backgroundColor: color("card"),
          padding: spacing.md,
          shadowColor: color("foreground"),
          ...(variant === "flat" ? elevation.none : elevation.sm),
        },
        style
      ]}
      {...props}
    />
  );
  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}
