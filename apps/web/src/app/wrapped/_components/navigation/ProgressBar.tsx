'use client';

import { useEffect, useState } from 'react';
import type { Slide } from '../../_lib/types';

interface ProgressBarProps {
  slides: Slide[];
  index: number;
  jumpTo: (i: number) => void;
}

export function ProgressBar({ slides, index, jumpTo }: ProgressBarProps) {
  // The first frame renders the active fill empty so it animates in on open.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="pointer-events-auto absolute top-5 left-0 right-0 flex justify-center gap-1 px-6 z-30">
      {slides.map((s, i) => {
        const filled = i < index || (ready && i === index);
        return (
          <button
            key={s.key}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => jumpTo(i)}
            className="group flex-1 max-w-[56px] h-1 rounded-full bg-white/25 hover:bg-white/40 overflow-hidden transition"
          >
            {/* CSS transform transition: compositor-driven during slide mounts,
                and retargets mid-fill when the user taps back or forward. */}
            <span
              className="block h-full origin-left rounded-full bg-white transition-transform ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{
                transform: `scaleX(${filled ? 1 : 0})`,
                transitionDuration: i === index ? '700ms' : '300ms',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
