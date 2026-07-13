import { View } from "react-native";
import { Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii } from "@/lib/tokens";

export function PeriodBadge({
  periodNumber,
  emphasized = false,
}: {
  periodNumber: number;
  emphasized?: boolean;
}) {
  const { color } = useTheme();

  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: emphasized ? color("primary") : color("secondary"),
      }}
    >
      <Txt
        variant="label"
        style={{
          color: emphasized ? color("primaryForeground") : color("secondaryForeground"),
          fontVariant: ["tabular-nums"],
          fontWeight: "800",
        }}
      >
        {periodNumber}
      </Txt>
    </View>
  );
}
