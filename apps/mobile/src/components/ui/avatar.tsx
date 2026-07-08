import { Image, View } from "react-native";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii } from "@/lib/tokens";

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
};

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const { color } = useTheme();
  const initials = getInitials(name);

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radii.pill }} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color("accent"),
      }}
    >
      <Txt variant={size > 56 ? "title" : "label"} style={{ fontWeight: "800" }}>
        {initials}
      </Txt>
    </View>
  );
}

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "IA";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
