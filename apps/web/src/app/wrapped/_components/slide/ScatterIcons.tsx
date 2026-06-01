'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { LucideIcon } from 'lucide-react';

export function ScatterIcons({ icons }: { icons: LucideIcon[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.scatter-icon').forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.4, rotate: gsap.utils.random(-60, 60) },
          {
            opacity: 0.35,
            scale: 1,
            rotate: 0,
            duration: 0.8,
            ease: 'back.out(1.6)',
            delay: 0.1 + i * 0.05,
          },
        );
        gsap.to(el, {
          y: `+=${gsap.utils.random(-20, 20)}`,
          rotate: `+=${gsap.utils.random(-15, 15)}`,
          duration: gsap.utils.random(3, 6),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: 0.8 + i * 0.1,
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [icons]);

  // Distribute ~12 icons across the slide using positions that avoid the
  // central text block.
  const positions = [
    { top: '8%', left: '6%', size: 44 },
    { top: '14%', right: '10%', size: 56 },
    { top: '30%', left: '12%', size: 36 },
    { top: '42%', right: '6%', size: 48 },
    { bottom: '18%', left: '8%', size: 52 },
    { bottom: '10%', right: '14%', size: 40 },
    { top: '6%', left: '46%', size: 32 },
    { bottom: '8%', left: '52%', size: 36 },
    { top: '72%', left: '22%', size: 44 },
    { top: '24%', right: '30%', size: 34 },
    { bottom: '32%', right: '32%', size: 38 },
    { top: '56%', left: '4%', size: 30 },
  ];

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {positions.map((pos, i) => {
        const Icon = icons[i % icons.length];
        return (
          <Icon
            key={i}
            className="scatter-icon absolute text-white drop-shadow-md"
            style={{
              ...pos,
              width: pos.size,
              height: pos.size,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
}
