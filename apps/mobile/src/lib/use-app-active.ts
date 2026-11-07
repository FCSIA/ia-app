import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useAppActive() {
  const [isActive, setIsActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setIsActive(state === "active");
    });
    return () => subscription.remove();
  }, []);
  return isActive;
}
