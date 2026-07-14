import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

export function Empty({ title, body, icon: Icon, action }: { title: string; body?: string; icon?: LucideIcon; action?: React.ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm }}>
      {Icon ? (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color("secondary"),
          }}
        >
          <Icon size={23} color={color("mutedForeground")} />
        </View>
      ) : null}
      <Txt variant="section" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" tone="muted" style={{ textAlign: "center" }}>
          {body}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}
