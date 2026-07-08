import { useEffect } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Txt } from "@/components/ui/typography";
import { spring } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

export type Segment<T extends string> = {
  label: string;
  value: T;
};

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { color } = useTheme();
  const width = useSharedValue(0);
  const index = Math.max(0, segments.findIndex((segment) => segment.value === value));
  const segmentWidth = segments.length ? width.value / segments.length : 0;
  const thumbStyle = useAnimatedStyle(() => ({
    width: segments.length ? width.value / segments.length : 0,
    transform: [{ translateX: withSpring(index * segmentWidth, spring) }],
  }));

  useEffect(() => {
    // Triggers animated style recalculation when value changes.
  }, [value]);

  function onLayout(event: LayoutChangeEvent) {
    width.value = event.nativeEvent.layout.width;
  }

  return (
    <View
      onLayout={onLayout}
      style={{
        minHeight: 42,
        borderRadius: radii.pill,
        padding: 4,
        backgroundColor: color("secondary"),
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 4,
            bottom: 4,
            left: 4,
            borderRadius: radii.pill,
            backgroundColor: color("card"),
          },
          thumbStyle,
        ]}
      />
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <PressableScale
            key={segment.value}
            haptic
            onPress={() => onChange(segment.value)}
            style={{
              flex: 1,
              minHeight: 34,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.xs,
            }}
          >
            <Txt variant="label" style={{ color: selected ? color("foreground") : color("mutedForeground") }} numberOfLines={1}>
              {segment.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}
