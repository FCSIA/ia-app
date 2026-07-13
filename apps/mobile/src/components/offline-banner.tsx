import { View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";

export function OfflineBanner({ stale }: { stale?: boolean }) {
  const { color, name } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderRadius: 14,
        borderWidth: name === "high-contrast" ? 1 : 0,
        borderColor: color("border"),
        backgroundColor: color("secondary"),
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
      }}
    >
      <WifiOff color={color("foreground")} size={18} />
      <Txt style={{ flex: 1, fontWeight: "700" }}>
        {stale ? "Showing saved data while offline." : "You’re offline."}
      </Txt>
    </View>
  );
}
