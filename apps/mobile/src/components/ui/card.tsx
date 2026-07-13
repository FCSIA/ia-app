import { View, type ViewProps } from "react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useTheme } from "@/lib/theme";
import { elevation, radii, spacing } from "@/lib/tokens";

type CardProps = ViewProps & {
  variant?: "default" | "flat";
  onPress?: () => void;
};

export function Card({ style, variant = "default", onPress, ...props }: CardProps) {
  const { color, name } = useTheme();
  const content = (
    <View
      style={[
        {
          borderRadius: radii.lg,
          borderWidth: name === "high-contrast" ? 1 : 0,
          borderColor: color("border"),
          backgroundColor: variant === "flat" ? color("secondary") : color("card"),
          padding: spacing.md,
          ...elevation.none,
        },
        style
      ]}
      {...props}
    />
  );
  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}
