import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/lib/theme";
import { duration, radii, spacing } from "@/lib/tokens";

export function Skeleton({ style }: { style?: ViewStyle }) {
  const { color } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: duration.slow * 3 }), -1, true);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0, 1], [0.45, 0.9]),
  }));

  return (
    <Animated.View
      style={[
        {
          height: 18,
          borderRadius: radii.md,
          backgroundColor: color("muted"),
        },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ gap: spacing.sm, padding: spacing.md }}>
          <Skeleton style={{ width: "45%" }} />
          <Skeleton style={{ height: 64, width: "100%" }} />
        </View>
      ))}
    </View>
  );
}
