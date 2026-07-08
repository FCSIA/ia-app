import { View } from "react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        minHeight: 34,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? color("primary") : color("secondary"),
      }}
    >
      <Txt variant="label" style={{ color: selected ? color("primaryForeground") : color("foreground") }} numberOfLines={1}>
        {label}
      </Txt>
    </PressableScale>
  );
}

export function ChipGroup<T extends string>({
  values,
  selected,
  labels,
  onToggle,
}: {
  values: readonly T[];
  selected: readonly T[];
  labels?: Partial<Record<T, string>>;
  onToggle: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {values.map((value) => (
        <FilterChip key={value} label={labels?.[value] ?? value} selected={selected.includes(value)} onPress={() => onToggle(value)} />
      ))}
    </View>
  );
}
