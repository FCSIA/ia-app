import { useEffect } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/lib/theme";
import { radii } from "@/lib/tokens";
import { spring } from "@/lib/motion";

export function Progress({
  value = 0,
  height = 8,
  style,
  indicatorColor,
}: {
  value?: number;
  height?: number;
  style?: ViewStyle;
  indicatorColor?: string;
}) {
  const { color } = useTheme();
  const widthAnim = useSharedValue(0);

  useEffect(() => {
    widthAnim.value = withSpring(Math.max(0, Math.min(100, value)), spring);
  }, [value, widthAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthAnim.value}%`,
  }));

  return (
    <View
      style={[
        {
          height,
          backgroundColor: color("secondary"),
          borderRadius: radii.pill,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            height: "100%",
            backgroundColor: indicatorColor || color("primary"),
            borderRadius: radii.pill,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}
