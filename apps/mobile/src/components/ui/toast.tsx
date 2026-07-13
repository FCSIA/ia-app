import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "@/components/ui/typography";
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
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, ...toast }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          top: insets.top + spacing.sm,
          gap: spacing.sm,
        }}
      >
        {toasts.map((toast) => (
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(180)}
            exiting={FadeOutUp.duration(160)}
            style={{
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: color("border"),
              backgroundColor: toast.tone === "success" ? color("primary") : color("card"),
              padding: spacing.md,
              gap: 2,
            }}
          >
            <Txt variant="label" style={{ color: toast.tone === "success" ? color("primaryForeground") : color("foreground") }}>
              {toast.title}
            </Txt>
            {toast.body ? (
              <Txt variant="caption" style={{ color: toast.tone === "success" ? color("primaryForeground") : color("mutedForeground") }}>
                {toast.body}
              </Txt>
            ) : null}
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
