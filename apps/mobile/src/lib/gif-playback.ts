import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const key = "ia_gif_autoplay";
let autoplay = false;
let loaded = false;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loaded = true;
    void AsyncStorage.getItem(key).then((value) => {
      autoplay = value !== "false";
      notify();
    }).catch(() => { autoplay = true; notify(); });
  }
  return () => { listeners.delete(listener); };
}
const read = () => autoplay;
const serverSnapshot = () => false;
function setAutoplay(next: boolean) {
  autoplay = next;
  notify();
  return AsyncStorage.setItem(key, String(next));
}
export function useGifAutoplay() {
  const value = useSyncExternalStore(subscribe, read, serverSnapshot);
  return { autoplay: value, setAutoplay };
}
