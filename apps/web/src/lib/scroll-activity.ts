"use client"

import { useEffect } from "react"

// One capture listener records when anything on the page last scrolled, so
// touch gestures can tell a press apart from a touch that stopped a scroll or
// turned into one.
let lastScrollAt = -Infinity
let listeners = 0

const recordScroll = () => {
  lastScrollAt = performance.now()
}

/** The `performance.now()` time of the most recent scroll anywhere on the page. */
export function lastScrollTime() {
  return lastScrollAt
}

/** Keeps the page-wide scroll timestamp current while `enabled`. */
export function useScrollActivity(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (listeners++ === 0) {
      document.addEventListener("scroll", recordScroll, {
        capture: true,
        passive: true,
      })
    }
    return () => {
      if (--listeners === 0) {
        document.removeEventListener("scroll", recordScroll, { capture: true })
      }
    }
  }, [enabled])
}
