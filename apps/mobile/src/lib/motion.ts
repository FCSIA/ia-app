import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export const spring = {
  damping: 18,
  stiffness: 220,
  mass: 0.8,
} as const;

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
