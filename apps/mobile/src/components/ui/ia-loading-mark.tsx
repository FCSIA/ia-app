import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { radii, spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { iaOrbitForTheme } from "@/components/ui/ia-orbit";

export function IaLoadingMark({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const { name } = useTheme();
  const pulse = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.05,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 0.95,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.85,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, opacity]);

  const cardDimensions =
    size === "sm"
      ? { width: 220, height: 110, logoWidth: 64, logoHeight: 64 }
      : size === "lg"
      ? { width: 320, height: 160, logoWidth: 104, logoHeight: 104 }
      : { width: 270, height: 135, logoWidth: 80, logoHeight: 80 };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.glassCard,
          {
            width: cardDimensions.width,
            height: cardDimensions.height,
            transform: [{ scale: pulse }],
            opacity: opacity,
          },
        ]}
      >
        <Image
          source={iaOrbitForTheme(name)}
          style={{
            width: cardDimensions.logoWidth,
            height: cardDimensions.logoHeight,
            resizeMode: "contain",
          }}
        />
      </Animated.View>
    </View>
  );
}

export function ScreenLoader() {
  return (
    <View style={styles.fullScreenOverlay}>
      <IaLoadingMark size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8, 8, 10, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  glassCard: {
    borderRadius: radii.xl,
    backgroundColor: "rgba(18, 18, 22, 0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(249, 115, 22, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
});
