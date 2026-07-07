import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readOfflineCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`ia_offline_${key}`);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export async function writeOfflineCache<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(`ia_offline_${key}`, JSON.stringify(value));
  } catch {
    // Offline cache is opportunistic.
  }
}
