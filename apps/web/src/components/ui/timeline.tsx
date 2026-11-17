import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: { dateTime: string; label: string };
  status?: "current" | "final";
}

/** A chronological record, rather than an interactive stepper. Order is caller-owned. */
export function Timeline({ events, label, empty = "No events yet.", className }: {
  events: readonly TimelineEvent[];
  label: string;
  empty?: ReactNode;
  className?: string;
}) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)}>
      {events.map((event, index) => (
        <li key={event.id} aria-current={event.status === "current" ? "step" : undefined} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
          <div aria-hidden="true" className="relative flex justify-center">
            {index < events.length - 1 ? <span className="absolute top-3 bottom-[-1.25rem] w-px bg-border" /> : null}
            <span className="relative mt-1.5 size-2 rounded-full bg-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]">
            <div className="font-medium text-foreground">{event.title}{event.status === "final" ? <span className="sr-only"> (Final status)</span> : null}</div>
            {event.timestamp ? <time className="block text-xs text-muted-foreground" dateTime={event.timestamp.dateTime}>{event.timestamp.label}</time> : null}
            {event.description ? <div className="whitespace-pre-wrap text-muted-foreground">{event.description}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
