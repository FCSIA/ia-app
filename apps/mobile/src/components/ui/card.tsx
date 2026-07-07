import { View, type ViewProps } from "react-native";
import { useTheme } from "@/lib/theme";

export function Card({ style, ...props }: ViewProps) {
  const { color } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: color("border"),
          backgroundColor: color("card"),
          padding: 14,
          shadowColor: color("foreground"),
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 1
        },
        style
      ]}
      {...props}
    />
  );
}
