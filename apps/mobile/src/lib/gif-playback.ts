import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const key = "ia_gif_autoplay";
let autoplay = false;
let loaded = false;
let revision = 0;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    const initialRevision = revision;
    void AsyncStorage.getItem(key).then((value) => {
      if (revision !== initialRevision) return;
      autoplay = value !== "false";
      notify();
    }).catch(() => { if (revision === initialRevision) { autoplay = true; notify(); } });
  }
  return () => { listeners.delete(listener); };
}
const read = () => autoplay;
const serverSnapshot = () => false;
function setAutoplay(next: boolean) {
  revision += 1;
  autoplay = next;
  notify();
  return AsyncStorage.setItem(key, String(next));
}
export function useGifAutoplay() {
  const value = useSyncExternalStore(subscribe, read, serverSnapshot);
  return { autoplay: value, setAutoplay };
}

const activeListeners = new Set<() => void>();
let appSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
function subscribeAppActive(listener: () => void) {
  if (activeListeners.size === 0) {
    appSubscription = AppState.addEventListener("change", () => activeListeners.forEach((notify) => notify()));
  }
  activeListeners.add(listener);
  return () => {
    activeListeners.delete(listener);
    if (activeListeners.size === 0) { appSubscription?.remove(); appSubscription = undefined; }
  };
}
const appActive = () => AppState.currentState === "active";
export function useGifAppActive() {
  return useSyncExternalStore(subscribeAppActive, appActive, serverSnapshot);
}
