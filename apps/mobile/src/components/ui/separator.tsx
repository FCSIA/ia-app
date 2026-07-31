import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import * as SeparatorPrimitive from "@rn-primitives/separator";
import { useTheme } from "@/lib/theme";

export type SeparatorProps = ComponentProps<typeof SeparatorPrimitive.Root>;

/**
 * A theme-aware hairline. It is decorative by default so dense lists do not
 * announce every divider; pass `decorative={false}` for a semantic boundary.
 */
export function Separator({
  decorative = true,
  orientation = "horizontal",
  style,
  ...props
}: SeparatorProps) {
  const { color } = useTheme();

  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      style={[
        {
          alignSelf: "stretch",
          flexShrink: 0,
          backgroundColor: color("border"),
        },
        orientation === "horizontal"
          ? { height: StyleSheet.hairlineWidth }
          : { width: StyleSheet.hairlineWidth },
        style,
      ]}
      {...props}
    />
  );
}
