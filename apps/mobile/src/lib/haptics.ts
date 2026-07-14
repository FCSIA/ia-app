import * as Haptics from "expo-haptics";

async function runHaptic(action: () => Promise<void>) {
  try {
    await action();
  } catch {
    // Haptics are best-effort on unsupported devices and simulators.
  }
}

export function tapLight() {
  return runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function tapMedium() {
  return runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function success() {
  return runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warning() {
  return runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
