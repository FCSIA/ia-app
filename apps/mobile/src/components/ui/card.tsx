import { View, type ViewProps } from "react-native";
import { useTheme } from "@/lib/theme";

export function Card({ style, ...props }: ViewProps) {
  const { color } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 22,
          borderWidth: 1,
          borderColor: color("border"),
          backgroundColor: color("card"),
          padding: 16
        },
        style
      ]}
      {...props}
    />
  );
}
