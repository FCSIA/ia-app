import type { LucideIcon } from "lucide-react-native";
import type { GestureResponderEvent } from "react-native";
import { PressableScale } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii } from "@/lib/tokens";

export { announcementAudience } from "./model";

export function AnnouncementIconAction({
  icon: Icon,
  label,
  onPress,
  selected = false,
  accentWhenSelected = false,
  tone = "muted",
  disabled = false,
  iconColor,
}: {
  icon: LucideIcon;
  label: string;
  onPress: (event?: GestureResponderEvent) => void;
  selected?: boolean;
  accentWhenSelected?: boolean;
  tone?: "muted" | "primary";
  disabled?: boolean;
  iconColor?: string;
}) {
  const { color } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      haptic={false}
      onPress={onPress}
      scaleTo={0.9}
      style={{
        width: 44,
        height: 44,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon
        size={19}
        strokeWidth={selected ? 2.2 : 1.8}
        color={
          iconColor ??
          (tone === "primary" || (accentWhenSelected && selected)
            ? color("primary")
            : color("mutedForeground"))
        }
      />
    </PressableScale>
  );
}
