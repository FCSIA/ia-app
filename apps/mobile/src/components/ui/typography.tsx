import { Text, type TextProps, type TextStyle } from "react-native";
import { text } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";

type TxtProps = TextProps & {
  variant?: keyof typeof text;
  tone?: "default" | "muted" | "primary" | "destructive" | "inverse";
};

export function Txt({ variant = "body", tone = "default", style, ...props }: TxtProps) {
  const { color } = useTheme();
  const textColor =
    tone === "muted"
      ? color("mutedForeground")
      : tone === "primary"
        ? color("primary")
        : tone === "destructive"
          ? color("destructive")
          : tone === "inverse"
            ? color("background")
            : color("foreground");

  return <Text style={[text[variant] as TextStyle, { color: textColor }, style]} {...props} />;
}
