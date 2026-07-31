"use client";

import { useEffect, useState } from "react";

/** Detects devices whose primary pointer is touch without changing SSR output. */
export function useTouchPrimary() {
  const [isTouchPrimary, setIsTouchPrimary] = useState(false);

  useEffect(() => {
    const pointerQuery = window.matchMedia("(pointer: coarse)");
    const updatePointerMode = () => {
      const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setIsTouchPrimary(hasTouch && pointerQuery.matches);
    };

    pointerQuery.addEventListener("change", updatePointerMode);
    window.addEventListener("pointerdown", updatePointerMode);
    updatePointerMode();

    return () => {
      pointerQuery.removeEventListener("change", updatePointerMode);
      window.removeEventListener("pointerdown", updatePointerMode);
    };
  }, []);

  return isTouchPrimary;
}
