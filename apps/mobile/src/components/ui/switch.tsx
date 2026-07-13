import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { tapMedium } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import { useTheme } from "@/lib/theme";

type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function Switch({ value, onValueChange, disabled, label }: SwitchProps) {
  const { color } = useTheme();
  const mutedColor = color("muted");
  const primaryColor = color("primary");
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const next = value ? 1 : 0;
    progress.value = reduceMotion ? next : withSpring(next, spring);
  }, [progress, reduceMotion, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [mutedColor, primaryColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 22 }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        void tapMedium();
        onValueChange(!value);
      }}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Animated.View
        style={[
          {
            width: 52,
            height: 30,
            borderRadius: 999,
            padding: 3,
            opacity: disabled ? 0.5 : 1,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: 999,
              backgroundColor: color("card"),
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
