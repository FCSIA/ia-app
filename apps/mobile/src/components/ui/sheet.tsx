import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: string[]; // Kept for type compatibility but ignored
  scrollable?: boolean;
};

export function Sheet({
  open,
  onClose,
  title,
  children,
  scrollable = false,
}: SheetProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      translateY.setValue(0);
    }
  }, [open, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      animationType="slide"
      transparent={true}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheetContent,
                {
                  transform: [{ translateY }],
                  backgroundColor: color("card"),
                  borderTopLeftRadius: radii.xl,
                  borderTopRightRadius: radii.xl,
                  paddingBottom: Math.max(spacing.xl, insets.bottom),
                },
              ]}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: "100%" }}
              >
                {/* Drag handle visual bar & touch area */}
                <View {...panResponder.panHandlers} style={styles.handleContainer}>
                  <View style={[styles.handle, { backgroundColor: color("border") }]} />
                </View>

                {title ? (
                  <View {...panResponder.panHandlers} style={styles.header}>
                    <Txt variant="section">{title}</Txt>
                  </View>
                ) : null}

                {scrollable ? (
                  <ScrollView
                    contentContainerStyle={{
                      paddingHorizontal: spacing.lg,
                      paddingBottom: spacing.xl,
                      gap: spacing.md,
                    }}
                    style={styles.scrollView}
                  >
                    {children}
                  </ScrollView>
                ) : (
                  <View
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingBottom: spacing.xl,
                      gap: spacing.md,
                    }}
                  >
                    {children}
                  </View>
                )}
              </KeyboardAvoidingView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    width: "100%",
    maxHeight: "85%",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  scrollView: {
    flexGrow: 0,
  },
});
