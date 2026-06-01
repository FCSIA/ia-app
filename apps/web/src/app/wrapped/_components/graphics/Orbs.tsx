'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function OrbsGraphic() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.orb').forEach((orb, i) => {
        gsap.to(orb, {
          x: `+=${gsap.utils.random(-40, 40)}`,
          y: `+=${gsap.utils.random(-40, 40)}`,
          scale: gsap.utils.random(0.8, 1.3),
          duration: gsap.utils.random(6, 12),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.2,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="orb absolute top-[12%] left-[8%] size-64 rounded-full bg-white/25 blur-3xl" />
      <div className="orb absolute top-[40%] right-[12%] size-96 rounded-full bg-black/20 blur-3xl" />
      <div className="orb absolute bottom-[10%] left-[30%] size-80 rounded-full bg-white/15 blur-3xl" />
      <div className="orb absolute top-[60%] left-[60%] size-72 rounded-full bg-white/20 blur-3xl" />
    </div>
  );
}
