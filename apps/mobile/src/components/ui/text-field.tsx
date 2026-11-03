import { TextInput, type TextInputProps } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useSheetInput } from "@/components/ui/sheet-input-context";
import { useTheme } from "@/lib/theme";

type FieldDensity = "compact" | "default";
type FieldState = "default" | "invalid";

type TextFieldProps = TextInputProps & {
  density?: FieldDensity;
  state?: FieldState;
};

export function TextField({
  density = "default",
  state = "default",
  ...props
}: TextFieldProps) {
  const { color } = useTheme();
  const withinSheet = useSheetInput();
  const { style, multiline, ...inputProps } = props;
  const compact = density === "compact";
  const Input = withinSheet ? BottomSheetTextInput : TextInput;
  return (
    <Input
      placeholderTextColor={color("mutedForeground")}
      selectionColor={color("primary")}
      multiline={multiline}
      aria-invalid={state === "invalid"}
      style={[
        {
          minHeight: compact ? 44 : 48,
          borderRadius: compact ? 10 : 14,
          borderWidth: 1,
          borderColor:
            state === "invalid" ? color("destructive") : color("input"),
          backgroundColor: color("card"),
          color: color("foreground"),
          paddingHorizontal: compact ? 12 : 14,
          paddingVertical: multiline ? (compact ? 10 : 12) : 0,
          fontSize: 15,
          textAlignVertical: multiline ? "top" : "center",
        },
        style,
      ]}
      {...inputProps}
    />
  );
}
