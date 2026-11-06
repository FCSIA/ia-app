import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { STORAGE_KEYS } from "./storage-keys";
import { useEffect, useRef, useState } from "react";

async function readOfflineCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEYS.offlineCachePrefix}${key}`);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

async function writeOfflineCache<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(`${STORAGE_KEYS.offlineCachePrefix}${key}`, JSON.stringify(value));
  } catch {
    // Offline cache is opportunistic.
  }
}

export async function clearOfflineCache() {
  const keys = await AsyncStorage.getAllKeys();
  const offlineKeys = keys.filter((key) => key.startsWith(STORAGE_KEYS.offlineCachePrefix));
  if (offlineKeys.length) await AsyncStorage.multiRemove(offlineKeys);
}

export function useOfflineValue<T>(key: string, liveValue: T | undefined | null) {
  const [cachedValue, setCachedValue] = useState<T | null | undefined>(undefined);
  const [isOffline, setIsOffline] = useState(false);
  const lastLiveSnapshot = useRef<string | null>(null);

  useEffect(() => {
    lastLiveSnapshot.current = null;
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
      const snapshot = JSON.stringify(liveValue);
      if (lastLiveSnapshot.current !== snapshot) {
        lastLiveSnapshot.current = snapshot;
        setCachedValue(liveValue);
        writeOfflineCache(key, liveValue);
      }
    }
  }, [key, liveValue]);

  return {
    value: liveValue ?? cachedValue,
    isOffline,
    isStale: liveValue == null && cachedValue != null,
  };
}
