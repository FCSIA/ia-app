import { Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

export function Empty({ title, body }: { title: string; body?: string }) {
  const { color } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 28, gap: 8 }}>
      <Text style={{ color: color("foreground"), fontSize: 16, fontWeight: "800" }}>{title}</Text>
      {body ? (
        <Text style={{ color: color("mutedForeground"), textAlign: "center", lineHeight: 20 }}>{body}</Text>
      ) : null}
    </View>
  );
}
