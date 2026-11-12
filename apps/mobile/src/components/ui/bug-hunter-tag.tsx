import { View } from "react-native";
import { Bug } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Txt } from "@/components/ui/typography";

type BugReward = { approvedBugCount?: number | null; bugTagColor?: string | null };

export function BugHunterTag({ user, compact = false }: { user?: BugReward | null; compact?: boolean }) {
  const { color } = useTheme();
  const count = user?.approvedBugCount ?? 0;
  if (count < 1) return null;
  const title = count >= 50 ? "Bug Legend" : count >= 20 ? "Bug Expert" : count >= 5 ? "Bug Hunter" : "Bug Finder";
  return (
    <View accessibilityRole="text" accessibilityLabel={`${title}, ${count} approved ${count === 1 ? "bug" : "bugs"}`} style={{ flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 4 }}>
      <Bug size={compact ? 12 : 14} color={color("primary")} strokeWidth={2.1} />
      {!compact ? <Txt variant="caption" style={{ color: color("primary"), fontWeight: "700" }}>{title}</Txt> : null}
    </View>
  );
}
