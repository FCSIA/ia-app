import { Text, View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

export function OfflineBanner({ stale }: { stale?: boolean }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: color("border"),
        backgroundColor: color("secondary"),
        padding: 12,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <WifiOff color={color("foreground")} size={18} />
      <Text style={{ color: color("foreground"), flex: 1, fontWeight: "700" }}>
        {stale ? "Showing last saved data while offline." : "You appear to be offline."}
      </Text>
    </View>
  );
}
