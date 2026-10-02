import { View } from "react-native";
import { Wrench } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

/**
 * Minimal shape any identity object can satisfy. Backend projections that
 * carry a user expose `isDeveloper`, so callers pass the object straight in.
 */
export type DeveloperFlagged = { isDeveloper?: boolean | null };

type DeveloperBadgeProps = {
  /** The user (or any object carrying `isDeveloper`). Renders nothing unless true. */
  user?: DeveloperFlagged | null;
  size?: number;
};

/**
 * Small wrench badge shown beside a developer's name. Purely presentational;
 * developer status is stored in the database and only a super admin can
 * change it via `users.admin.setDeveloper`.
 */
export function DeveloperBadge({ user, size = 13 }: DeveloperBadgeProps) {
  const { color } = useTheme();
  if (!user?.isDeveloper) return null;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Developer"
      style={{ flexShrink: 0, justifyContent: "center", marginLeft: 4 }}
    >
      <Wrench size={size} color={color("primary")} strokeWidth={2.25} />
    </View>
  );
}
