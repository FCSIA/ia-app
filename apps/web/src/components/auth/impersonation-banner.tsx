"use client";

import { useRef, useState, type PointerEvent } from "react";
import { EyeOff, GripVertical } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type SessionWithImpersonation = {
  session?: { impersonatedBy?: string | null };
};

const VIEWPORT_INSET = 8;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ImpersonationBanner() {
  const session = authClient.useSession();
  const isImpersonating = Boolean(
    (session.data as SessionWithImpersonation | null)?.session?.impersonatedBy,
  );
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    position: { x: number; y: number };
  } | null>(null);

  if (!isImpersonating) return null;

  const stop = async () => {
    setPending(true);
    try {
      const { error } = await authClient.admin.stopImpersonating();
      if (error) {
        throw new Error(error.message || "Could not stop impersonation.");
      }
      window.location.assign("/admin");
    } catch {
      setPending(false);
    }
  };

  const nudge = (x: number, y: number) => {
    setPosition((current) => {
      const banner = bannerRef.current;
      if (!banner) return { x: current.x + x, y: current.y + y };

      const rect = banner.getBoundingClientRect();
      return {
        x: clamp(
          current.x + x,
          current.x - rect.left + VIEWPORT_INSET,
          current.x + window.innerWidth - rect.right - VIEWPORT_INSET,
        ),
        y: clamp(
          current.y + y,
          current.y - rect.top + VIEWPORT_INSET,
          current.y + window.innerHeight - rect.bottom - VIEWPORT_INSET,
        ),
      };
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    setPosition((current) => {
      const banner = bannerRef.current;
      const x = drag.position.x + event.clientX - drag.clientX;
      const y = drag.position.y + event.clientY - drag.clientY;
      if (!banner) return { x, y };

      const rect = banner.getBoundingClientRect();
      return {
        x: clamp(
          x,
          current.x - rect.left + VIEWPORT_INSET,
          current.x + window.innerWidth - rect.right - VIEWPORT_INSET,
        ),
        y: clamp(
          y,
          current.y - rect.top + VIEWPORT_INSET,
          current.y + window.innerHeight - rect.bottom - VIEWPORT_INSET,
        ),
      };
    });
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 bottom-[calc(3.5rem+max(1rem,env(safe-area-inset-bottom)))] z-50 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-100 px-2 py-2 text-sm text-amber-950 shadow-lg dark:bg-amber-950 dark:text-amber-100 lg:bottom-4"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-compact"
        className={dragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none"}
        aria-label="Move impersonation notice"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          const distance = event.shiftKey ? 48 : 16;
          const movement = {
            ArrowUp: [0, -distance],
            ArrowDown: [0, distance],
            ArrowLeft: [-distance, 0],
            ArrowRight: [distance, 0],
          } as const;
          const delta = movement[event.key as keyof typeof movement];
          if (!delta) return;
          event.preventDefault();
          nudge(...delta);
        }}
      >
        <GripVertical aria-hidden />
      </Button>
      <span className="min-w-0">You’re viewing the app as another user.</span>
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        leadingIcon={EyeOff}
        disabled={pending}
        onClick={() => void stop()}
      >
        {pending ? "Ending…" : "Exit"}
      </Button>
    </div>
  );
}
