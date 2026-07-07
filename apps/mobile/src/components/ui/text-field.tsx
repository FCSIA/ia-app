import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/lib/theme";

export function TextField(props: TextInputProps) {
  const { color } = useTheme();
  return (
    <TextInput
      placeholderTextColor={color("mutedForeground")}
      selectionColor={color("primary")}
      style={{
        minHeight: 46,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: color("border"),
        backgroundColor: color("card"),
        color: color("foreground"),
        paddingHorizontal: 14,
        fontSize: 15
      }}
      {...props}
    />
  );
}
