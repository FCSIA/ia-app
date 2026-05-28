'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Slide } from '../../_lib/types';

interface ProgressBarProps {
  slides: Slide[];
  index: number;
  jumpTo: (i: number) => void;
}

export function ProgressBar({ slides, index, jumpTo }: ProgressBarProps) {
  const progressRef = useRef<HTMLDivElement>(null);

  // Animate the active progress bar fill smoothly.
  useLayoutEffect(() => {
    if (!progressRef.current || slides.length === 0) return;
    const bars = progressRef.current.querySelectorAll<HTMLElement>('.progress-fill');
    bars.forEach((bar, i) => {
      gsap.to(bar, {
        width: i < index ? '100%' : i === index ? '100%' : '0%',
        duration: i === index ? 0.7 : 0.3,
        ease: 'power2.out',
      });
    });
  }, [index, slides.length]);

  return (
    <div
      ref={progressRef}
      className="pointer-events-auto absolute top-5 left-0 right-0 flex justify-center gap-1 px-6 z-30"
    >
      {slides.map((s, i) => (
        <button
          key={s.key}
          type="button"
          aria-label={`Go to slide ${i + 1}`}
          onClick={() => jumpTo(i)}
          className="group flex-1 max-w-[56px] h-1 rounded-full bg-white/25 hover:bg-white/40 overflow-hidden transition"
        >
          <span
            className="progress-fill block h-full bg-white rounded-full"
            style={{ width: i < index ? '100%' : '0%' }}
          />
        </button>
      ))}
    </div>
  );
}
