import { LayoutChangeEvent, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Txt } from "@/components/ui/typography";
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
  density = "default",
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  density?: "compact" | "default";
}) {
  const { color } = useTheme();
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(0);
  const compact = density === "compact";
  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value),
  );
  const thumbStyle = useAnimatedStyle(() => {
    const segmentWidth = segments.length
      ? Math.max(0, width.value - 8) / segments.length
      : 0;
    const offset = index * segmentWidth;
    return {
      width: segmentWidth,
      transform: [
        {
          translateX: reduceMotion
            ? offset
            : withTiming(offset, {
                duration: 160,
                easing: Easing.out(Easing.cubic),
              }),
        },
      ],
    };
  });

  function onLayout(event: LayoutChangeEvent) {
    width.value = event.nativeEvent.layout.width;
  }

  return (
    <View
      onLayout={onLayout}
      style={{
        minHeight: compact ? 44 : 48,
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
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            haptic
            hitSlop={compact ? { top: 4, bottom: 4 } : undefined}
            onPress={() => onChange(segment.value)}
            style={{
              flex: 1,
              minHeight: compact ? 36 : 40,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.xs,
            }}
          >
            <Txt
              variant="label"
              style={{
                color: selected
                  ? color("foreground")
                  : color("mutedForeground"),
              }}
              numberOfLines={1}
            >
              {segment.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}
