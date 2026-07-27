import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { tapLight } from "@/lib/haptics";

type PressableScaleProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  haptic?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ children, haptic = true, scaleTo = 0.97, onPressIn, onPressOut, onPress, style, ...props }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole={props.accessibilityRole ?? "button"}
      onPressIn={(event) => {
        animatePress(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animatePress(1);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void tapLight();
        onPress?.(event);
      }}
      style={[{ transform: [{ scale }] }, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
