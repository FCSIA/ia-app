'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { LucideIcon } from 'lucide-react';
import {
  EASE_IN_OUT_SINE,
  prefersReducedMotion,
  randomBetween,
  startAmbientLoops,
} from '../../_lib/motion';

// Distribute ~12 icons across the slide using positions that avoid the
// central text block.
const POSITIONS = [
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

const ICON_OPACITY = 0.35;

export function ScatterIcons({ icons }: { icons: LucideIcon[] }) {
  const ref = useRef<HTMLDivElement>(null);

  // Entrance pop on the icon itself (GSAP).
  useLayoutEffect(() => {
    if (!ref.current) return;
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set('.scatter-icon', { opacity: ICON_OPACITY });
        return;
      }
      gsap.utils.toArray<HTMLElement>('.scatter-icon').forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.4, rotate: gsap.utils.random(-60, 60) },
          {
            opacity: ICON_OPACITY,
            scale: 1,
            rotate: 0,
            duration: 0.8,
            ease: 'back.out(1.6)',
            delay: 0.1 + i * 0.05,
          },
        );
      });
    }, ref);
    return () => ctx.revert();
  }, [icons]);

  // Ambient drift on the wrapper (compositor-driven), so it never competes
  // with the entrance tween for the icon's transform.
  useEffect(
    () =>
      startAmbientLoops(ref.current, '.scatter-drift', (_, i) => ({
        keyframes: [
          { transform: 'translateY(0px) rotate(0deg)' },
          {
            transform: `translateY(${randomBetween(-20, 20)}px) rotate(${randomBetween(-15, 15)}deg)`,
          },
        ],
        options: {
          duration: randomBetween(3000, 6000),
          delay: 800 + i * 100,
          easing: EASE_IN_OUT_SINE,
          direction: 'alternate',
        },
      })),
    [],
  );

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {POSITIONS.map(({ size, ...pos }, i) => {
        const Icon = icons[i % icons.length];
        return (
          <span
            key={i}
            className="scatter-drift absolute block"
            style={{ ...pos, width: size, height: size }}
          >
            <Icon
              className="scatter-icon block size-full text-white drop-shadow-md"
              style={{ opacity: 0 }}
            />
          </span>
        );
      })}
    </div>
  );
}
