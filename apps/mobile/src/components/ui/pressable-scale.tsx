import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { spring } from "@/lib/motion";
import { tapLight } from "@/lib/haptics";

type PressableScaleProps = PressableProps & {
  children: ReactNode;
  haptic?: boolean;
  scaleTo?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ children, haptic = true, scaleTo = 0.97, onPressIn, onPressOut, onPress, style, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={props.accessibilityRole ?? "button"}
      onPressIn={(event) => {
        scale.value = withSpring(scaleTo, spring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, spring);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void tapLight();
        onPress?.(event);
      }}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
