import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/lib/theme";

export function TextField(props: TextInputProps) {
  const { color } = useTheme();
  const { style, multiline, ...inputProps } = props;
  return (
    <TextInput
      placeholderTextColor={color("mutedForeground")}
      selectionColor={color("primary")}
      multiline={multiline}
      style={[
        {
          minHeight: 48,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: color("border"),
          backgroundColor: color("card"),
          color: color("foreground"),
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          fontSize: 15,
          textAlignVertical: multiline ? "top" : "center",
        },
        style,
      ]}
      {...inputProps}
    />
  );
}
