'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function RingsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.ring', {
        rotate: 360,
        duration: 40,
        ease: 'none',
        repeat: -1,
        transformOrigin: 'center',
      });
      gsap.to('.ring-reverse', {
        rotate: -360,
        duration: 60,
        ease: 'none',
        repeat: -1,
        transformOrigin: 'center',
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <svg viewBox="0 0 800 800" className="w-[180%] max-w-none opacity-30">
        <g className="ring" style={{ transformOrigin: '400px 400px' }}>
          <circle cx="400" cy="400" r="320" stroke="white" strokeWidth="1" fill="none" />
          <circle cx="400" cy="400" r="280" stroke="white" strokeWidth="1" fill="none" strokeDasharray="4 12" />
        </g>
        <g className="ring-reverse" style={{ transformOrigin: '400px 400px' }}>
          <circle cx="400" cy="400" r="220" stroke="white" strokeWidth="1" fill="none" strokeDasharray="2 10" />
          <circle cx="400" cy="400" r="160" stroke="white" strokeWidth="1" fill="none" />
        </g>
        <g className="ring" style={{ transformOrigin: '400px 400px' }}>
          <circle cx="400" cy="400" r="100" stroke="white" strokeWidth="1" fill="none" strokeDasharray="6 6" />
        </g>
      </svg>
    </div>
  );
}
