"use client"

let iosSwitch: HTMLLabelElement | null = null

function isAppleTouchDevice() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

/**
 * A light haptic tick, for moments like a long press opening a menu. Android
 * vibrates. iOS Safari has no vibration API, but from iOS 18 it plays the
 * system tick when a switch-style checkbox toggles, so a hidden one is
 * clicked. Where neither applies this does nothing.
 */
export function hapticTick() {
  if (typeof window === "undefined") return
  try {
    if (typeof navigator.vibrate === "function") {
      // Chrome refuses (and logs) vibration before the page's first tap.
      if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(8)
      return
    }
    if (!isAppleTouchDevice()) return
    if (!iosSwitch) {
      iosSwitch = document.createElement("label")
      iosSwitch.setAttribute("aria-hidden", "true")
      iosSwitch.style.display = "none"
      const input = document.createElement("input")
      input.type = "checkbox"
      input.tabIndex = -1
      input.setAttribute("switch", "")
      iosSwitch.appendChild(input)
      document.head.appendChild(iosSwitch)
    }
    iosSwitch.click()
  } catch {
    // Haptics are a nicety; never let them break the gesture.
  }
}
