import { View } from "react-native";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

export function Stat({ value, label }: { value: string | number; label: string }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        borderRadius: radii.lg,
        backgroundColor: color("secondary"),
        padding: spacing.md,
        gap: 2,
      }}
    >
      <Txt variant="title">{value}</Txt>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}
