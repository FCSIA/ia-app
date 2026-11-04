"use client";

import { useEffect, useState } from "react";
import { api } from "~/apps/convex/src/_generated/api";
import { useQuery } from "@/lib/convex-react";
import { hasRole, useCurrentUser } from "@/lib/auth";
import { calendarDate } from "@/components/calendar/calendar-date";
import { parseTimeToMinutes } from "@/components/schedule/schedule-utils";
import { schoolDateKey } from "@/lib/school-date";

export type ClassLock = { label: string; endTime: string; joke: string };

const studentJokes = [
  "The snake is in class too. It's taking notes. Without hands.",
  "The snake has been sent to the front office. It'll be back after the bell.",
  "Cold-blooded, not rule-breaking. The snake will wait.",
  "Even snakes have an attendance policy.",
  "Your teacher can see your face right now. It's the face of someone looking for Snake.",
  "Sssh. The snake is studying for the same test you are.",
  "The snake is hibernating until the bell. Highly recommend paying attention instead.",
];
const staffJokes = [
  "Shouldn't you be teaching? The snake won't tell anyone.",
  "The students are watching. Probably for the snake.",
  "Lead by example. The snake is.",
];

/** Stable per class block, so the joke doesn't change on every minute tick. */
function pick(lines: string[], seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return lines[Math.abs(hash) % lines.length];
}

/** School-zone wall clock, refreshed on each minute boundary and when the tab returns. */
function useSchoolMinute() {
  const [now, setNow] = useState(() => calendarDate());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(calendarDate());
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const onVisible = () => { if (!document.hidden) setNow(calendarDate()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

/**
 * The class period happening now, if Snake should be closed for it. Students
 * with a saved schedule keep their free periods; everyone else is locked out
 * during every class period. Lunch, passing time, and days off stay open.
 */
export function useClassLock(): ClassLock | null {
  const user = useCurrentUser();
  const now = useSchoolMinute();
  const dateKey = schoolDateKey(now);
  const day = useQuery(api.schedule.dashboard.getDay, user ? { dateKey } : "skip");
  if (!user || !day) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const hasClass = (entry: (typeof day.blocks)[number]["entry"]) => !!entry && (!!entry.courseId || !!entry.className.trim());
  // A saved schedule with no classes in it tells us nothing about free periods.
  const knowsFreePeriods = day.blocks.some(block => hasClass(block.entry));
  const block = day.blocks.find(block =>
    block.kind === "PERIOD" &&
    minutes >= parseTimeToMinutes(block.startTime) &&
    minutes < parseTimeToMinutes(block.endTime) &&
    (!knowsFreePeriods || hasClass(block.entry)),
  );
  if (!block) return null;

  const staff = !hasRole(user, "STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN");
  return {
    label: block.entry?.className.trim() || block.displayLabel,
    endTime: block.endTime,
    joke: pick(staff ? staffJokes : studentJokes, `${dateKey}:${block.key}`),
  };
}
