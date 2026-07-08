import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

export const spring = {
  damping: 18,
  stiffness: 220,
  mass: 0.8,
} as const;

export function entering(index = 0) {
  return FadeInDown.duration(220).delay(index * 45);
}

export const listEntering = FadeIn.duration(180);
export const listLayout = LinearTransition.springify().damping(18).stiffness(180);

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
