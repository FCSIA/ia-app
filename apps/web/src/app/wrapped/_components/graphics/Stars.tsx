'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function StarsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.twinkle').forEach((el, i) => {
        gsap.to(el, {
          opacity: gsap.utils.random(0.2, 1),
          scale: gsap.utils.random(0.6, 1.4),
          duration: gsap.utils.random(1.4, 3.2),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.08,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  const stars = Array.from({ length: 60 });
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((_, i) => (
        <span
          key={i}
          className="twinkle absolute block size-1 rounded-full bg-white"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: 0.2 + Math.random() * 0.6,
          }}
        />
      ))}
    </div>
  );
}
