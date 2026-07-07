import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

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

export function useOfflineValue<T>(key: string, liveValue: T | undefined | null) {
  const [cachedValue, setCachedValue] = useState<T | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    readOfflineCache<T>(key).then(setCachedValue);
  }, [key]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (liveValue !== undefined && liveValue !== null) {
      setCachedValue(liveValue);
      writeOfflineCache(key, liveValue);
    }
  }, [key, liveValue]);

  return {
    value: liveValue ?? cachedValue,
    isOffline,
    isStale: liveValue == null && cachedValue != null,
  };
}
