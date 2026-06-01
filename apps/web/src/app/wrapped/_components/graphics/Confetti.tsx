'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function ConfettiGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.confetti').forEach((el) => {
        gsap.to(el, {
          y: `+=${gsap.utils.random(-80, 80)}`,
          x: `+=${gsap.utils.random(-40, 40)}`,
          rotate: `+=${gsap.utils.random(-180, 180)}`,
          duration: gsap.utils.random(4, 9),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  const pieces = Array.from({ length: 36 });
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti absolute block rounded-sm bg-white/70"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: `${6 + Math.random() * 10}px`,
            height: `${6 + Math.random() * 14}px`,
            opacity: 0.35 + Math.random() * 0.5,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}
