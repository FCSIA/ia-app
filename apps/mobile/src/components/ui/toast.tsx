import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { X } from "lucide-react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "@/components/ui/typography";
import { spring } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

type Toast = {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "success" | "warning";
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, ...toast }]);
    timers.current.set(id, setTimeout(() => dismissToast(id), 3200));
  }, [dismissToast]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          top: insets.top + spacing.sm,
          gap: spacing.sm,
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const foreground = toast.tone === "success" ? color("primaryForeground") : color("foreground");
  const mutedForeground = toast.tone === "success" ? color("primaryForeground") : color("mutedForeground");

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const shouldDismiss = Math.abs(event.translationX) > 72 || Math.abs(event.velocityX) > 700;
      if (!shouldDismiss) {
        translateX.value = reduceMotion ? 0 : withSpring(0, spring);
        return;
      }

      if (reduceMotion) {
        scheduleOnRN(onDismiss, toast.id);
        return;
      }

      const direction = Math.sign(event.translationX || event.velocityX) || 1;
      translateX.value = withTiming(direction * width, { duration: 160 }, (finished) => {
        if (finished) scheduleOnRN(onDismiss, toast.id);
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateX.value), [0, Math.max(120, width * 0.45)], [1, 0.25], "clamp"),
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(180)}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(160)}
      >
        <Animated.View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            {
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: color("border"),
              backgroundColor: toast.tone === "success" ? color("primary") : color("card"),
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            },
            animatedStyle,
          ]}
        >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="label" style={{ color: foreground }}>
            {toast.title}
          </Txt>
          {toast.body ? (
            <Txt variant="caption" style={{ color: mutedForeground }}>
              {toast.body}
            </Txt>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onDismiss(toast.id)}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <X color={foreground} size={19} strokeWidth={2} />
        </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
