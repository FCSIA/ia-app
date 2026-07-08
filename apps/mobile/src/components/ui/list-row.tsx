import type { ReactNode } from "react";
import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { ChevronRight } from "lucide-react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

type ListRowProps = {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListRow({ icon: Icon, title, subtitle, leading, trailing, onPress }: ListRowProps) {
  const { color } = useTheme();
  const content = (
    <View
      style={{
        minHeight: 58,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: color("border"),
        backgroundColor: color("card"),
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      {leading}
      {Icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color("secondary"),
          }}
        >
          <Icon size={19} color={color("foreground")} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body" numberOfLines={1} style={{ fontWeight: "800" }}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={20} color={color("mutedForeground")} /> : null)}
    </View>
  );

  if (!onPress) return content;
  return <PressableScale onPress={onPress}>{content}</PressableScale>;
}
