'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';

interface NavigationControlsProps {
  go: (dir: 1 | -1) => void;
  atStart: boolean;
  atEnd: boolean;
}

export function NavigationControls({ go, atStart, atEnd }: NavigationControlsProps) {
  return (
    <>
      {/* Close button */}
      <Link
        href="/home"
        aria-label="Close"
        className="absolute top-4 right-4 z-30 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/30 transition border border-white/20"
      >
        <X size={18} />
      </Link>

      {/* Nav buttons (Desktop) */}
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={atStart}
        aria-label="Previous slide"
        className="absolute inset-y-0 left-0 z-20 flex w-16 sm:w-20 items-center justify-center text-white/60 transition hover:bg-gradient-to-r hover:from-black/20 hover:to-transparent hover:text-white disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeft size={36} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={atEnd}
        aria-label="Next slide"
        className="absolute inset-y-0 right-0 z-20 flex w-16 sm:w-20 items-center justify-center text-white/60 transition hover:bg-gradient-to-l hover:from-black/20 hover:to-transparent hover:text-white disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRight size={36} />
      </button>

      {/* Tap zones (Mobile) */}
      <button
        type="button"
        aria-label="Previous"
        onClick={() => go(-1)}
        className="absolute inset-y-0 left-0 w-1/3 z-10 sm:hidden"
      />
      <button
        type="button"
        aria-label="Next"
        onClick={() => go(1)}
        className="absolute inset-y-0 right-0 w-1/3 z-10 sm:hidden"
      />
    </>
  );
}
