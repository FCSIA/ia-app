import { useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { tapLight } from "@/lib/haptics";

type PressableScaleProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  haptic?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  haptic = true,
  scaleTo = 0.985,
  onPressIn,
  onPressOut,
  onPress,
  style,
  ...props
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animatePress = (pressed: boolean) => {
    const nextScale = pressed && !reduceMotion ? scaleTo : 1;
    const nextOpacity = pressed ? 0.76 : 1;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: nextScale,
        duration: reduceMotion ? 0 : pressed ? 70 : 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: nextOpacity,
        duration: pressed ? 55 : 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole={props.accessibilityRole ?? "button"}
      onPressIn={(event) => {
        animatePress(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animatePress(false);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void tapLight();
        onPress?.(event);
      }}
      style={[{ opacity, transform: [{ scale }] }, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
