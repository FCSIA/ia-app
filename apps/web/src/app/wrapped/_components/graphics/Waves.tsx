'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function WavesGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.wave', {
        x: '-50%',
        duration: 18,
        ease: 'none',
        repeat: -1,
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="wave absolute bottom-0 left-0 w-[200%] h-[40%] opacity-25"
      >
        <path
          fill="white"
          d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1600,300 1600,200 L1600,400 L0,400 Z"
        />
      </svg>
      <svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="wave absolute bottom-0 left-0 w-[200%] h-[30%] opacity-15"
        style={{ transform: 'translateX(-25%)' }}
      >
        <path
          fill="black"
          d="M0,200 C200,300 400,100 600,200 C800,300 1000,100 1200,200 C1400,300 1600,100 1600,200 L1600,400 L0,400 Z"
        />
      </svg>
    </div>
  );
}
